import express from 'express';
import pool from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import crypto from 'crypto';
import { createCheckoutSession } from '../services/stripe.js';

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

    // Generate unique code
    let code;
    let attempts = 0;
    do {
      code = generateGiftCardCode();
      const existing = await pool.query('SELECT id FROM gift_cards WHERE code = $1', [code]);
      if (existing.rows.length === 0) break;
      attempts++;
      if (attempts > 10) {
        throw new Error('Impossible de générer un code unique');
      }
    } while (true);

    // Calculate expiry date (1 year from now)
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check which columns exist in gift_cards table
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'gift_cards' AND column_name IN ('category', 'used', 'purchaser_id', 'purchaser_email', 'purchaser_name')
      `);
      const existingColumns = columnCheck.rows.map(row => row.column_name);
      const hasNewColumns = existingColumns.length > 0;

      // Build INSERT query based on available columns
      let insertColumns = ['code', 'amount', 'balance', 'expiry_date', 'status'];
      let insertValues = ['$1', '$2', '$2', '$3', "'active'"];
      let paramValues = [code, amount, expiryDate.toISOString().split('T')[0]];
      let paramCount = 4;

      if (hasNewColumns) {
        if (existingColumns.includes('category')) {
          insertColumns.push('category');
          insertValues.push(`$${paramCount++}`);
          paramValues.push(category);
        }
        if (existingColumns.includes('used')) {
          insertColumns.push('used');
          insertValues.push('false');
        }
        if (existingColumns.includes('purchaser_id')) {
          insertColumns.push('purchaser_id');
          insertValues.push(`$${paramCount++}`);
          paramValues.push(userId);
        }
        if (existingColumns.includes('purchaser_email')) {
          insertColumns.push('purchaser_email');
          insertValues.push(`$${paramCount++}`);
          paramValues.push(purchaser_email);
        }
        if (existingColumns.includes('purchaser_name')) {
          insertColumns.push('purchaser_name');
          insertValues.push(`$${paramCount++}`);
          paramValues.push(purchaser_name || null);
        }
      }

      const insertQuery = `
        INSERT INTO gift_cards (${insertColumns.join(', ')})
        VALUES (${insertValues.join(', ')})
        RETURNING *
      `;

      // Create gift card
      const result = await client.query(insertQuery, paramValues);

      const giftCard = result.rows[0];

      // Create purchase transaction
      await client.query(
        `INSERT INTO gift_card_transactions (gift_card_id, amount, transaction_type, notes)
         VALUES ($1, $2, 'purchase', 'Achat de carte cadeau')`,
        [giftCard.id, amount]
      );

      let checkoutSessionId = null;

      if (create_payment_intent) {
        try {
          const lineItems = [{
            price_data: {
              currency: 'eur',
              product_data: {
                name: `Carte cadeau ${category} - ${amount}€`,
                description: `Carte cadeau ${category} d'une valeur de ${amount}€`,
              },
              unit_amount: Math.round(parseFloat(amount) * 100), // Price in cents
            },
            quantity: 1,
          }];

          const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cartes-cadeaux?success=true&code=${code}`;
          const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/cartes-cadeaux?cancelled=true`;

          const stripeSession = await createCheckoutSession(lineItems, successUrl, cancelUrl, {
            gift_card_id: giftCard.id,
            gift_card_code: code,
            category: category,
            user_id: userId || 'guest',
            purchaser_email: purchaser_email,
            recipient_email: recipient_email,
          });

          if (stripeSession && stripeSession.id && stripeSession.url) {
            checkoutSessionId = stripeSession.id;
            const checkoutUrl = stripeSession.url;
            
            await client.query('COMMIT');
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
            throw new Error('Stripe session creation failed: no session ID or URL returned');
          }
        } catch (stripeError) {
          console.error('Error creating Stripe checkout session:', stripeError);
          await client.query('ROLLBACK');
          throw new Error(`Erreur lors de la création de la session de paiement: ${stripeError.message}`);
        }
      } else {
        // If no payment needed, send email immediately
        // TODO: Send email with code to recipient_email
      }

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
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

// GET /api/gift-cards/check/:code - Check gift card validity (public)
router.get('/check/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `SELECT 
        code, 
        balance, 
        expiry_date, 
        status, 
        used,
        category
       FROM gift_cards 
       WHERE code = $1`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carte cadeau non trouvée'
      });
    }

    const card = result.rows[0];
    const today = new Date();
    const expiryDate = new Date(card.expiry_date);

    // Check if expired
    if (expiryDate < today) {
      return res.json({
        success: true,
        valid: false,
        message: 'Cette carte cadeau a expiré',
        card: {
          ...card,
          balance: parseFloat(card.balance || 0),
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
          ...card,
          balance: parseFloat(card.balance || 0),
          used: true
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
          ...card,
          balance: parseFloat(card.balance || 0)
        }
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Carte cadeau valide',
      card: {
        ...card,
        balance: parseFloat(card.balance || 0)
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


