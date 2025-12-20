import express from 'express';
import dotenv from 'dotenv';
import pool from '../db.js';
import { optionalAuth, verifyToken } from '../middleware/auth.js';
import { sendOrderConfirmation } from '../services/email.js';
import { createPaymentIntent } from '../services/stripe.js';

// Ensure environment variables are loaded
dotenv.config();

// Helper function to sync client from order
async function syncClient(data) {
  const { name, email, phone, address, city, postal_code, country } = data;
  
  if (!email) return null;

  // Check if client exists
  const existing = await pool.query(
    'SELECT * FROM clients WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existing.rows.length > 0) {
    // Update client stats
    const client = existing.rows[0];
    await pool.query(
      `UPDATE clients 
       SET total_orders = total_orders + 1,
           last_order_date = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [client.id]
    );
    return client.id;
  } else {
    // Create new client
    const result = await pool.query(
      `INSERT INTO clients (name, email, phone, address, city, postal_code, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [name, email.toLowerCase(), phone || null, address || null, city || null, postal_code || null, country || 'France']
    );
    return result.rows[0].id;
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
      create_payment_intent
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

    // Create Stripe payment intent if requested
    let paymentIntentId = null;
    let clientSecret = null;
    let stripeError = null;
    
    if (create_payment_intent) {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      
      if (!stripeKey) {
        console.error('❌ STRIPE_SECRET_KEY is not set in environment variables');
        console.error('   Payment intent creation skipped. Please add STRIPE_SECRET_KEY to your .env file.');
        console.error('   For deployed services (Vercel/Railway), add it to the environment variables in the dashboard.');
        stripeError = 'STRIPE_SECRET_KEY not configured';
      } else if (!stripeKey.startsWith('sk_')) {
        console.error('❌ STRIPE_SECRET_KEY format is invalid');
        console.error('   Stripe secret keys must start with "sk_test_" or "sk_live_"');
        console.error('   Current key prefix:', stripeKey.substring(0, 10) + '...');
        stripeError = 'STRIPE_SECRET_KEY format is invalid';
      } else {
        try {
          console.log('🔄 Creating Stripe payment intent for amount:', total, 'EUR');
          const paymentResult = await createPaymentIntent(total, 'eur', {
            order_type: 'product',
            guest_email: guest_email || null,
            user_id: userId || null
          });
          paymentIntentId = paymentResult.paymentIntentId;
          clientSecret = paymentResult.clientSecret;
          console.log('✅ Payment intent created successfully');
          console.log('   Payment Intent ID:', paymentIntentId);
          console.log('   Client Secret:', clientSecret.substring(0, 20) + '...');
        } catch (err) {
          console.error('❌ Error creating payment intent:', err.message);
          console.error('   Error type:', err.type || 'Unknown');
          console.error('   Error code:', err.code || 'N/A');
          console.error('   Full error:', err);
          stripeError = err.message || 'Failed to create payment intent';
        }
      }
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (
          user_id, 
          total, 
          guest_name, 
          guest_email, 
          guest_phone, 
          shipping_address, 
          shipping_city, 
          shipping_postal_code, 
          shipping_country,
          status,
          payment_status,
          payment_method,
          stripe_payment_intent_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
        RETURNING id, created_at`,
        [
          userId,
          total,
          guest_name || null,
          guest_email || null,
          guest_phone || null,
          shipping_address || null,
          shipping_city || null,
          shipping_postal_code || null,
          shipping_country || 'France',
          'confirmed',
          paymentIntentId ? 'pending' : 'unpaid',
          payment_method || null,
          paymentIntentId
        ]
      );

      const order = orderResult.rows[0];

      // Create order items
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, price) 
           VALUES ($1, $2, $3, $4)`,
          [order.id, item.id, item.quantity, item.price]
        );
      }

      await client.query('COMMIT');

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

      // Log payment intent status for debugging
      if (create_payment_intent) {
        if (clientSecret) {
          console.log('✅ Payment intent included in order response');
        } else {
          console.warn('⚠️  Payment intent was requested but not created');
          console.warn('   STRIPE_SECRET_KEY available:', !!process.env.STRIPE_SECRET_KEY);
          if (stripeError) {
            console.warn('   Error reason:', stripeError);
          }
        }
      }

      res.status(201).json({
        success: true,
        message: 'Commande créée avec succès',
        data: {
          order_id: order.id,
          total: total,
          created_at: order.created_at,
          payment_intent: clientSecret ? {
            client_secret: clientSecret,
            payment_intent_id: paymentIntentId
          } : null,
          // Include error info if payment intent was requested but failed
          ...(create_payment_intent && !clientSecret && stripeError ? {
            payment_intent_error: stripeError
          } : {})
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
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

    const result = await pool.query(
      `SELECT 
        o.id, 
        o.total, 
        o.status, 
        o.created_at,
        COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows
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

    // Get order
    const orderResult = await pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    const order = orderResult.rows[0];

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

    // Get order items
    const itemsResult = await pool.query(
      `SELECT 
        oi.id,
        oi.quantity,
        oi.price,
        p.id as product_id,
        p.title,
        p.image
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        items: itemsResult.rows
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

