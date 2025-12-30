import express from 'express';
import dotenv from 'dotenv';
import { getCollection, getDB } from '../db-mongodb.js';
import { optionalAuth, verifyToken } from '../middleware/auth.js';
import { sendOrderConfirmation } from '../services/email.js';
import { createCheckoutLink } from '../services/square.js';

// Ensure environment variables are loaded
dotenv.config();

// Helper function to sync client from order
async function syncClient(data) {
  const { name, email, phone, address, city, postal_code, country } = data;
  
  if (!email) return null;

  const clientsCollection = await getCollection('clients');
  
  // Check if client exists
  const existing = await clientsCollection.findOne({ email: email.toLowerCase() });

  if (existing) {
    // Update client stats
    await clientsCollection.updateOne(
      { _id: existing._id },
      {
        $inc: { total_orders: 1 },
        $set: {
          last_order_date: new Date(),
          updated_at: new Date()
        }
      }
    );
    return existing._id;
  } else {
    // Create new client
    const clientData = {
      name,
      email: email.toLowerCase(),
      phone: phone || null,
      address: address || null,
      city: city || null,
      postal_code: postal_code || null,
      country: country || 'France',
      total_orders: 1,
      total_spent: 0,
      last_order_date: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
    const result = await clientsCollection.insertOne(clientData);
    return result.insertedId;
  }
}

const router = express.Router();

// Use optional auth for GET routes (allows both authenticated and guest access)
// Use verifyToken for routes that need authentication

// POST /api/orders - Create order (works for both authenticated and guest users)
router.post('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || null; // Get from token if available
    
    const { 
      items, 
      total, 
      // Guest information (if not logged in)
      guest_name,
      guest_email,
      guest_phone,
      shipping_address,
      shipping_city,
      shipping_postal_code,
      shipping_country,
      // Payment
      payment_method,
      create_payment_intent,
      // Gift card
      gift_card_code
    } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Le panier est vide'
      });
    }

    if (!total || total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le total est invalide'
      });
    }

    // If no user_id (not logged in), require guest information
    if (!userId) {
      if (!guest_name || !guest_email || !shipping_address || !shipping_city || !shipping_postal_code) {
        return res.status(400).json({
          success: false,
          message: 'Veuillez remplir tous les champs requis pour la livraison'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guest_email)) {
        return res.status(400).json({
          success: false,
          message: 'Format d\'email invalide'
        });
      }
    }

    // Handle gift card if provided
    let giftCardApplied = null;
    let amountToPay = total;
    let giftCardAmount = 0;
    
    if (gift_card_code) {
      try {
        const giftCardsCollection = await getCollection('gift_cards');
        const card = await giftCardsCollection.findOne({ code: gift_card_code.toUpperCase() });
        
        if (!card) {
          return res.status(400).json({
            success: false,
            message: 'Carte cadeau non trouvée'
          });
        }
        
        // Check if expired
        if (card.expiry_date && new Date(card.expiry_date) < new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Cette carte cadeau a expiré'
          });
        }
        
        // Check if active
        if (card.status !== 'active') {
          return res.status(400).json({
            success: false,
            message: 'Cette carte cadeau n\'est pas active'
          });
        }
        
        // Check category restriction - product orders can only use "boutique" or "libre" cards
        const cardCategory = card.category;
        const allowedCategories = ['boutique', 'libre'];
        if (cardCategory && !allowedCategories.includes(cardCategory.toLowerCase())) {
          return res.status(400).json({
            success: false,
            message: `Cette carte cadeau est réservée aux ${cardCategory === 'atelier' ? 'ateliers' : cardCategory}. Elle ne peut pas être utilisée pour des produits de la boutique.`
          });
        }
        
        const balance = parseFloat(card.balance || 0);
        if (balance <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Cette carte cadeau n\'a plus de solde'
          });
        }
        
        // Calculate how much to apply
        giftCardAmount = Math.min(balance, total);
        amountToPay = Math.round((total - giftCardAmount) * 100) / 100; // Round to 2 decimals
        
        giftCardApplied = {
          code: card.code,
          card_id: card._id,
          amount_applied: giftCardAmount,
          previous_balance: balance,
          new_balance: balance - giftCardAmount
        };
        
        console.log(`🎁 Gift card ${card.code} applied: ${giftCardAmount}€ (Remaining to pay: ${amountToPay}€)`);
      } catch (giftCardError) {
        console.error('Error applying gift card:', giftCardError);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'application de la carte cadeau'
        });
      }
    }

    // Create Square checkout link if there's still an amount to pay
    let checkoutUrl = null;
    let checkoutSessionId = null;
    let squareError = null;
    
    if (create_payment_intent && amountToPay > 0) {
      const accessToken = process.env.SQUARE_ACCESS_TOKEN;
      const applicationId = process.env.SQUARE_APPLICATION_ID;
      
      if (!accessToken || !applicationId) {
        console.error('❌ SQUARE_ACCESS_TOKEN or SQUARE_APPLICATION_ID is not set in environment variables');
        console.error('   Payment checkout creation skipped. Please add Square credentials to your .env file.');
        console.error('   For deployed services (Vercel/Railway), add them to the environment variables in the dashboard.');
        squareError = 'Square credentials not configured';
      } else {
        try {
          console.log('🔄 Creating Square checkout link for amount:', amountToPay, 'EUR');
          
          // Get frontend URL for redirects
          const getFrontendUrl = () => {
            if (process.env.FRONTEND_URL) {
              return process.env.FRONTEND_URL;
            }
            const origin = req.headers.origin || req.headers.referer;
            if (origin) {
              try {
                const url = new URL(origin);
                return url.origin;
              } catch (e) {
                // Invalid URL
              }
            }
            return 'http://localhost:3000';
          };
          
          const frontendUrl = getFrontendUrl();
          const successUrl = `${frontendUrl}/boutique?order=success`;
          const cancelUrl = `${frontendUrl}/panier?cancelled=true`;
          
          // Create line items for the remaining amount
          const lineItems = [{
            name: giftCardApplied 
              ? `Commande (après carte cadeau ${giftCardApplied.code})`
              : 'Commande',
            quantity: 1,
            amount: amountToPay,
          }];
          
          const checkoutResult = await createCheckoutLink(lineItems, successUrl, cancelUrl, {
            order_type: 'product',
            guest_email: guest_email || null,
            user_id: userId || null,
            gift_card_code: gift_card_code || null,
            gift_card_amount: giftCardAmount || null
          });
          
          checkoutSessionId = checkoutResult.id;
          checkoutUrl = checkoutResult.url;
          console.log('✅ Square checkout link created successfully');
          console.log('   Checkout Session ID:', checkoutSessionId);
        } catch (err) {
          console.error('❌ Error creating Square checkout link:', err.message);
          console.error('   Full error:', err);
          squareError = err.message || 'Failed to create checkout link';
        }
      }
    } else if (giftCardApplied && amountToPay === 0) {
      // Gift card covers the full amount - no checkout needed
      console.log('✅ Gift card covers full amount - no checkout needed');
    }

    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');
    const giftCardsCollection = await getCollection('gift_cards');
    const giftCardTransactionsCollection = await getCollection('gift_card_transactions');
    
    try {
      // Determine payment status
      let paymentStatus = 'unpaid';
      if (giftCardApplied && amountToPay === 0) {
        paymentStatus = 'paid'; // Fully covered by gift card
      } else if (checkoutSessionId) {
        paymentStatus = 'pending'; // Waiting for checkout
      }

      // Create order
      const orderData = {
        user_id: userId || null,
        total: total,
        guest_name: guest_name || null,
        guest_email: guest_email || null,
        guest_phone: guest_phone || null,
        shipping_address: shipping_address || null,
        shipping_city: shipping_city || null,
        shipping_postal_code: shipping_postal_code || null,
        shipping_country: shipping_country || 'France',
        status: 'confirmed',
        payment_status: paymentStatus,
        payment_method: giftCardApplied ? (amountToPay > 0 ? 'gift_card_partial' : 'gift_card') : (payment_method || null),
        square_payment_id: checkoutSessionId || null,
        // Gift card info
        gift_card_code: giftCardApplied?.code || null,
        gift_card_amount: giftCardAmount || null,
        amount_paid_by_card: amountToPay > 0 ? null : 0, // Will be set after checkout
        created_at: new Date()
      };

      const orderResult = await ordersCollection.insertOne(orderData);
      const orderId = orderResult.insertedId;

      // If gift card fully covers the order, redeem it now
      if (giftCardApplied && amountToPay === 0) {
        // Deduct from gift card balance
        const newBalance = giftCardApplied.new_balance;
        const newStatus = newBalance <= 0 ? 'used' : 'active';
        
        await giftCardsCollection.updateOne(
          { _id: giftCardApplied.card_id },
          {
            $set: {
              balance: newBalance,
              status: newStatus,
              used: newBalance <= 0,
              updated_at: new Date()
            }
          }
        );

        // Record transaction
        await giftCardTransactionsCollection.insertOne({
          gift_card_id: giftCardApplied.card_id,
          order_id: orderId,
          amount: -giftCardAmount, // Negative for usage
          transaction_type: 'usage',
          notes: `Commande #${orderId}`,
          created_at: new Date()
        });

        console.log(`✅ Gift card ${giftCardApplied.code} redeemed: ${giftCardAmount}€ deducted. New balance: ${newBalance}€`);
      }

      // Create order items
      const orderItems = items.map(item => ({
        order_id: orderId,
        product_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      if (orderItems.length > 0) {
        await orderItemsCollection.insertMany(orderItems);
      }

      const order = {
        id: orderId,
        created_at: orderData.created_at
      };

      // Sync client if guest order
      if (!userId && guest_email) {
        try {
          await syncClient({
            name: guest_name,
            email: guest_email,
            phone: guest_phone,
            address: shipping_address,
            city: shipping_city,
            postal_code: shipping_postal_code,
            country: shipping_country
          });
        } catch (clientError) {
          console.error('Error syncing client:', clientError);
          // Don't fail the order if client sync fails
        }
      }

      // Send confirmation email
      if (guest_email || userId) {
        try {
          await sendOrderConfirmation(guest_email || '', {
            orderId: order.id,
            customerName: guest_name || 'Client',
            total: total,
            createdAt: order.created_at
          });
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Don't fail the order if email fails
        }
      }

      // Log checkout link status for debugging
      if (create_payment_intent) {
        if (checkoutUrl) {
          console.log('✅ Checkout link included in order response');
        } else {
          console.warn('⚠️  Checkout link was requested but not created');
          console.warn('   Square credentials available:', !!process.env.SQUARE_ACCESS_TOKEN);
          if (squareError) {
            console.warn('   Error reason:', squareError);
          }
        }
      }

      res.status(201).json({
        success: true,
        message: giftCardApplied && amountToPay === 0 
          ? 'Commande créée et payée avec votre carte cadeau' 
          : 'Commande créée avec succès',
        data: {
          order_id: order.id,
          total: total,
          created_at: order.created_at,
          // Gift card info
          gift_card: giftCardApplied ? {
            code: giftCardApplied.code,
            amount_applied: giftCardAmount,
            remaining_balance: giftCardApplied.new_balance,
            fully_covered: amountToPay === 0
          } : null,
          amount_to_pay: amountToPay,
          // Checkout info (only if there's remaining amount)
          checkout: checkoutUrl ? {
            checkout_url: checkoutUrl,
            checkout_session_id: checkoutSessionId
          } : null,
          // Include error info if checkout was requested but failed
          ...(create_payment_intent && amountToPay > 0 && !checkoutUrl && squareError ? {
            payment_intent_error: squareError
          } : {})
        }
      });
    } catch (error) {
      // If order was created, try to clean up
      if (orderId) {
        try {
          await ordersCollection.deleteOne({ _id: orderId });
          await orderItemsCollection.deleteMany({ order_id: orderId });
        } catch (cleanupError) {
          console.error('Error cleaning up failed order:', cleanupError);
        }
      }
      throw error;
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la commande',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/orders - Get user's orders (requires authentication)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');
    
    const orders = await ordersCollection.find({ user_id: userId })
      .sort({ created_at: -1 })
      .toArray();

    // Get item counts for each order
    const ordersWithCounts = await Promise.all(orders.map(async (order) => {
      const itemCount = await orderItemsCollection.countDocuments({ order_id: order._id });
      return {
        id: order._id,
        total: order.total,
        status: order.status,
        created_at: order.created_at,
        item_count: itemCount
      };
    }));

    res.json({
      success: true,
      data: ordersWithCounts
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/orders/:id - Get order details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');
    const productsCollection = await getCollection('products');

    // Get order
    const order = await ordersCollection.findOne({ _id: id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Check if user has access
    // For authenticated users: must be the owner or admin
    // For guest orders: require email verification (in future, implement secure token system)
    if (order.user_id) {
      // Authenticated user order - check ownership
      if (order.user_id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé'
        });
      }
    } else {
      // Guest order - only allow if user is admin, or implement email verification
      // For now, only admins can view guest orders for security
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé. Les commandes invitées nécessitent une vérification.'
        });
      }
    }

    // Get order items with product details
    const orderItems = await orderItemsCollection.find({ order_id: id }).toArray();
    const items = await Promise.all(orderItems.map(async (item) => {
      const product = await productsCollection.findOne({ _id: item.product_id });
      return {
        id: item._id,
        quantity: item.quantity,
        price: item.price,
        product_id: item.product_id,
        title: product?.title || null,
        image: product?.image || null
      };
    }));

    res.json({
      success: true,
      data: {
        id: order._id,
        ...order,
        items: items
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la commande',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

