import express from 'express';
import { getCollection } from '../db-mongodb.js';
import { optionalAuth } from '../middleware/auth.js';
import crypto from 'crypto';
import { createCheckoutLink } from '../services/square.js';

const router = express.Router();

// Generate unique gift card code
function generateGiftCardCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/gift-cards/purchase - Purchase a gift card (public, with payment)
router.post('/purchase', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || null;
    const { 
      category, 
      amount, 
      recipient_name, 
      recipient_email, 
      purchaser_name, 
      purchaser_email,
      create_payment_intent 
    } = req.body;

    if (!category || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Catégorie et montant sont requis'
      });
    }

    if (!recipient_email || !purchaser_email) {
      return res.status(400).json({
        success: false,
        message: 'Les emails du destinataire et de l\'acheteur sont requis'
      });
    }

    const giftCardsCollection = await getCollection('gift_cards');
    const transactionsCollection = await getCollection('gift_card_transactions');

    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = generateGiftCardCode();
      const existing = await giftCardsCollection.findOne({ code: code });
      if (!existing) break;
      attempts++;
      if (attempts > 10) {
        throw new Error('Impossible de générer un code unique');
      }
    } while (true);

    // Calculate expiry date (1 year from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    try {
      // Create gift card
      const giftCardData = {
        code: code,
        amount: parseFloat(amount),
        balance: parseFloat(amount),
        expiry_date: expiryDate,
        status: 'active',
        category: category || null,
        used: false,
        purchaser_id: userId || null,
        purchaser_email: purchaser_email || null,
        purchaser_name: purchaser_name || null,
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await giftCardsCollection.insertOne(giftCardData);
      const giftCard = {
        id: result.insertedId,
        ...giftCardData
      };

      // Create purchase transaction
      await transactionsCollection.insertOne({
        gift_card_id: giftCard.id,
        amount: parseFloat(amount),
        transaction_type: 'purchase',
        notes: 'Achat de carte cadeau',
        created_at: new Date()
      });

      let checkoutSessionId = null;

      if (create_payment_intent) {
        try {
          const lineItems = [{
            name: `Carte cadeau ${category} - ${amount}€`,
            description: `Carte cadeau ${category} d'une valeur de ${amount}€`,
            quantity: 1,
            amount: parseFloat(amount),
          }];

          // Get frontend URL - prioritize environment variable, then try to extract from request
          const getFrontendUrl = () => {
            // First priority: Environment variable (most reliable)
            if (process.env.FRONTEND_URL) {
              return process.env.FRONTEND_URL;
            }
            
            // Second priority: Try to extract from request headers
            const origin = req.headers.origin || req.headers.referer;
            if (origin) {
              try {
                const url = new URL(origin);
                const extractedOrigin = url.origin;
                // Only use if it's not localhost (we're in production)
                if (!extractedOrigin.includes('localhost') && !extractedOrigin.includes('127.0.0.1')) {
                  return extractedOrigin;
                }
              } catch (e) {
                // Invalid URL, continue to next option
              }
            }
            
            // Check if we're actually running locally (backend is on localhost)
            const isLocalBackend = !process.env.RAILWAY_ENVIRONMENT && 
                                    !process.env.VERCEL && 
                                    (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV);
            
            // Only use localhost if backend is definitely running locally
            if (isLocalBackend) {
              return 'http://localhost:3000';
            }
            
            // Production: require FRONTEND_URL to be set
            console.error('❌ FRONTEND_URL not configured. Cannot determine frontend URL for redirect.');
            throw new Error('FRONTEND_URL environment variable must be set in production. Please configure it in your deployment platform.');
          };
          
          const frontendUrl = getFrontendUrl();
          console.log(`🔗 Using frontend URL for redirect: ${frontendUrl}`);
          const successUrl = `${frontendUrl}/cartes-cadeaux?success=true&code=${code}`;
          const cancelUrl = `${frontendUrl}/cartes-cadeaux?cancelled=true`;

          const squareCheckout = await createCheckoutLink(lineItems, successUrl, cancelUrl, {
            gift_card_id: giftCard.id,
            gift_card_code: code,
            category: category,
            user_id: userId || 'guest',
            purchaser_email: purchaser_email,
            recipient_email: recipient_email,
          });

          if (squareCheckout && squareCheckout.id && squareCheckout.url) {
            checkoutSessionId = squareCheckout.id;
            const checkoutUrl = squareCheckout.url;
            
            return res.status(201).json({
              success: true,
              message: 'Carte cadeau créée. Redirection vers le paiement...',
              data: {
                gift_card_id: giftCard.id,
                code: code,
                checkout_session_id: checkoutSessionId,
                checkout_url: checkoutUrl
              }
            });
          } else {
            // Rollback on error
            await giftCardsCollection.deleteOne({ _id: giftCard.id });
            await transactionsCollection.deleteMany({ gift_card_id: giftCard.id });
            throw new Error('Square checkout link creation failed: no session ID or URL returned');
          }
        } catch (squareError) {
          console.error('Error creating Square checkout link:', squareError);
          // Cleanup on error
          try {
            await giftCardsCollection.deleteOne({ _id: giftCard.id });
            await transactionsCollection.deleteMany({ gift_card_id: giftCard.id });
          } catch (cleanupError) {
            console.error('Error cleaning up failed gift card:', cleanupError);
          }
          throw new Error(`Erreur lors de la création de la session de paiement: ${squareError.message}`);
        }
      } else {
        // If no payment needed, send email immediately
        // TODO: Send email with code to recipient_email
      }

      res.status(201).json({
        success: true,
        message: 'Carte cadeau créée. Redirection vers le paiement...',
        data: {
          gift_card_id: giftCard.id,
          code: code,
          checkout_session_id: checkoutSessionId
        }
      });
    } catch (error) {
      // Cleanup on error
      try {
        if (giftCard?.id) {
          await giftCardsCollection.deleteOne({ _id: giftCard.id });
          await transactionsCollection.deleteMany({ gift_card_id: giftCard.id });
        }
      } catch (cleanupError) {
        console.error('Error cleaning up failed gift card:', cleanupError);
      }
      throw error;
    }
  } catch (error) {
    console.error('Error purchasing gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'achat de la carte cadeau',
      error: error.message
    });
  }
});

// POST /api/gift-cards/apply - Apply gift card to an order (calculates discount)
router.post('/apply', optionalAuth, async (req, res) => {
  try {
    const { code, order_total } = req.body;

    if (!code || !order_total || order_total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Code de carte cadeau et montant total requis'
      });
    }

    const giftCardsCollection = await getCollection('gift_cards');
    const card = await giftCardsCollection.findOne({ code: code.toUpperCase() });

    if (!card) {
      return res.status(404).json({
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

    // Check balance
    const balance = parseFloat(card.balance || 0);
    if (balance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Cette carte cadeau n\'a plus de solde'
      });
    }

    // Calculate how much can be applied
    const orderTotal = parseFloat(order_total);
    const amountToApply = Math.min(balance, orderTotal);
    const remainingToPay = Math.max(0, orderTotal - amountToApply);
    const remainingBalance = balance - amountToApply;

    res.json({
      success: true,
      message: 'Carte cadeau valide',
      data: {
        card_code: card.code,
        card_balance: balance,
        amount_applied: amountToApply,
        remaining_to_pay: remainingToPay,
        remaining_card_balance: remainingBalance,
        fully_covered: remainingToPay === 0
      }
    });
  } catch (error) {
    console.error('Error applying gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'application de la carte cadeau',
      error: error.message
    });
  }
});

// POST /api/gift-cards/redeem - Redeem gift card for an order (deducts balance)
router.post('/redeem', optionalAuth, async (req, res) => {
  try {
    const { code, amount, order_id, order_type } = req.body;

    if (!code || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Code de carte cadeau et montant requis'
      });
    }

    const giftCardsCollection = await getCollection('gift_cards');
    const transactionsCollection = await getCollection('gift_card_transactions');
    
    const card = await giftCardsCollection.findOne({ code: code.toUpperCase() });

    if (!card) {
      return res.status(404).json({
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

    // Check balance
    const balance = parseFloat(card.balance || 0);
    const amountToDeduct = parseFloat(amount);

    if (balance < amountToDeduct) {
      return res.status(400).json({
        success: false,
        message: `Solde insuffisant. Solde disponible: ${balance}€`
      });
    }

    // Deduct balance
    const newBalance = balance - amountToDeduct;
    const newStatus = newBalance <= 0 ? 'used' : 'active';

    await giftCardsCollection.updateOne(
      { _id: card._id },
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
    await transactionsCollection.insertOne({
      gift_card_id: card._id,
      order_id: order_id || null,
      amount: -amountToDeduct, // Negative for usage
      transaction_type: 'usage',
      notes: `Utilisation pour ${order_type || 'commande'}${order_id ? ` #${order_id}` : ''}`,
      created_at: new Date()
    });

    console.log(`✅ Gift card ${code} redeemed: ${amountToDeduct}€ deducted. New balance: ${newBalance}€`);

    res.json({
      success: true,
      message: 'Carte cadeau utilisée avec succès',
      data: {
        card_code: card.code,
        amount_deducted: amountToDeduct,
        previous_balance: balance,
        new_balance: newBalance,
        card_status: newStatus
      }
    });
  } catch (error) {
    console.error('Error redeeming gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'utilisation de la carte cadeau',
      error: error.message
    });
  }
});

// GET /api/gift-cards/check/:code - Check gift card validity (public)
router.get('/check/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const giftCardsCollection = await getCollection('gift_cards');
    const card = await giftCardsCollection.findOne({ code: code.toUpperCase() });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Carte cadeau non trouvée'
      });
    }
    const today = new Date();
    const expiryDate = new Date(card.expiry_date);

    // Check if expired
    if (expiryDate < today) {
      return res.json({
        success: true,
        valid: false,
        message: 'Cette carte cadeau a expiré',
        card: {
          id: card._id,
          code: card.code,
          balance: parseFloat(card.balance || 0),
          expiry_date: card.expiry_date,
          status: card.status,
          used: card.used,
          category: card.category,
          expired: true
        }
      });
    }

    // Check if used
    if (card.used || card.status === 'used') {
      return res.json({
        success: true,
        valid: false,
        message: 'Cette carte cadeau a déjà été utilisée',
        card: {
          id: card._id,
          code: card.code,
          balance: parseFloat(card.balance || 0),
          expiry_date: card.expiry_date,
          status: card.status,
          used: true,
          category: card.category
        }
      });
    }

    // Check if active
    if (card.status !== 'active') {
      return res.json({
        success: true,
        valid: false,
        message: 'Cette carte cadeau n\'est pas active',
        card: {
          id: card._id,
          code: card.code,
          balance: parseFloat(card.balance || 0),
          expiry_date: card.expiry_date,
          status: card.status,
          used: card.used,
          category: card.category
        }
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Carte cadeau valide',
      card: {
        id: card._id,
        code: card.code,
        balance: parseFloat(card.balance || 0),
        expiry_date: card.expiry_date,
        status: card.status,
        used: card.used,
        category: card.category
      }
    });
  } catch (error) {
    console.error('Error checking gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de la carte cadeau',
      error: error.message
    });
  }
});

export default router;


