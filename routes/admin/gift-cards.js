import express from 'express';
import pool from '../../db.js';
import { verifyToken, requireAdmin } from '../../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// Generate unique gift card code
function generateGiftCardCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/admin/gift-cards - List gift cards
router.get('/', async (req, res) => {
  try {
    const { status, search } = req.query;

    let query = 'SELECT * FROM gift_cards WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (search) {
      query += ` AND code ILIKE $${paramCount++}`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(card => ({
        ...card,
        amount: parseFloat(card.amount || 0),
        balance: parseFloat(card.balance || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching gift cards:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cartes cadeaux',
      error: error.message
    });
  }
});

// GET /api/admin/gift-cards/:id - Get gift card details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get gift card
    const cardResult = await pool.query(
      'SELECT * FROM gift_cards WHERE id = $1',
      [id]
    );

    if (cardResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carte cadeau non trouvée'
      });
    }

    // Get transactions
    const transactionsResult = await pool.query(
      `SELECT 
        t.*,
        o.id as order_id
       FROM gift_card_transactions t
       LEFT JOIN orders o ON t.order_id = o.id
       WHERE t.gift_card_id = $1
       ORDER BY t.created_at DESC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...cardResult.rows[0],
        amount: parseFloat(cardResult.rows[0].amount || 0),
        balance: parseFloat(cardResult.rows[0].balance || 0),
        transactions: transactionsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la carte cadeau',
      error: error.message
    });
  }
});

// POST /api/admin/gift-cards - Create gift card
router.post('/', async (req, res) => {
  try {
    const { amount, expiry_date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Le montant est requis et doit être positif'
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

    const result = await pool.query(
      `INSERT INTO gift_cards (code, amount, balance, expiry_date)
       VALUES ($1, $2, $2, $3)
       RETURNING *`,
      [code, amount, expiry_date || null]
    );

    // Create purchase transaction
    await pool.query(
      `INSERT INTO gift_card_transactions (gift_card_id, amount, transaction_type, notes)
       VALUES ($1, $2, 'purchase', 'Carte cadeau créée')`,
      [result.rows[0].id, amount]
    );

    res.status(201).json({
      success: true,
      message: 'Carte cadeau créée avec succès',
      data: {
        ...result.rows[0],
        amount: parseFloat(result.rows[0].amount),
        balance: parseFloat(result.rows[0].balance)
      }
    });
  } catch (error) {
    console.error('Error creating gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la carte cadeau',
      error: error.message
    });
  }
});

// PUT /api/admin/gift-cards/:id - Update gift card
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, balance, expiry_date, status } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (amount !== undefined) {
      updates.push(`amount = $${paramCount++}`);
      values.push(amount);
    }
    if (balance !== undefined) {
      updates.push(`balance = $${paramCount++}`);
      values.push(balance);
    }
    if (expiry_date !== undefined) {
      updates.push(`expiry_date = $${paramCount++}`);
      values.push(expiry_date);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    updates.push('updated_at = NOW()');
    values.push(id);
    const query = `UPDATE gift_cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carte cadeau non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Carte cadeau mise à jour',
      data: {
        ...result.rows[0],
        amount: parseFloat(result.rows[0].amount || 0),
        balance: parseFloat(result.rows[0].balance || 0)
      }
    });
  } catch (error) {
    console.error('Error updating gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la carte cadeau',
      error: error.message
    });
  }
});

// DELETE /api/admin/gift-cards/:id - Delete gift card
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM gift_cards WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carte cadeau non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Carte cadeau supprimée'
    });
  } catch (error) {
    console.error('Error deleting gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la carte cadeau',
      error: error.message
    });
  }
});

// GET /api/admin/gift-cards/check/:code - Check gift card balance (public endpoint)
router.get('/check/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      'SELECT code, balance, expiry_date, status FROM gift_cards WHERE code = $1',
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carte cadeau non trouvée'
      });
    }

    const card = result.rows[0];

    // Check if expired
    if (card.expiry_date && new Date(card.expiry_date) < new Date()) {
      return res.json({
        success: false,
        message: 'Carte cadeau expirée',
        expired: true
      });
    }

    // Check if active
    if (card.status !== 'active') {
      return res.json({
        success: false,
        message: 'Carte cadeau inactive',
        active: false
      });
    }

    res.json({
      success: true,
      data: {
        code: card.code,
        balance: parseFloat(card.balance || 0),
        expiry_date: card.expiry_date
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

