import express from 'express';
import { getCollection } from '../../db-mongodb.js';
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

    const giftCardsCollection = await getCollection('gift_cards');
    
    const query = {};
    if (status) query.status = status;
    if (search) query.code = { $regex: search, $options: 'i' };

    // Check for expired cards and update them
    try {
      await giftCardsCollection.updateMany(
        {
          expiry_date: { $lt: new Date() },
          status: 'active',
          used: { $ne: true }
        },
        {
          $set: {
            status: 'expired',
            used: true
          }
        }
      );
    } catch (error) {
      console.warn('Could not update expired cards:', error.message);
    }

    const cards = await giftCardsCollection.find(query)
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      success: true,
      data: cards.map(card => {
        const expiryDate = card.expiry_date ? new Date(card.expiry_date) : null;
        const isExpired = expiryDate && expiryDate < new Date();
        const cardUsed = card.used || false;
        const cardStatus = isExpired ? 'expired' : (cardUsed ? 'used' : card.status || 'active');
        
        return {
          id: card._id,
          ...card,
          amount: parseFloat(card.amount || 0),
          balance: parseFloat(card.balance || 0),
          status: cardStatus,
          used: cardUsed
        };
      })
    });
  } catch (error) {
    console.error('Error fetching gift cards:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des cartes cadeaux',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/gift-cards/:id - Get gift card details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const giftCardsCollection = await getCollection('gift_cards');
    const transactionsCollection = await getCollection('gift_card_transactions');
    const ordersCollection = await getCollection('orders');

    // Get gift card
    const card = await giftCardsCollection.findOne({ _id: id });

    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Carte cadeau non trouvée'
      });
    }

    // Get transactions
    const transactions = await transactionsCollection.find({ gift_card_id: id })
      .sort({ created_at: -1 })
      .toArray();

    const transactionsWithOrders = await Promise.all(transactions.map(async (t) => {
      const order = t.order_id ? await ordersCollection.findOne({ _id: t.order_id }) : null;
      return {
        id: t._id,
        ...t,
        order_id: order?._id || null
      };
    }));

    res.json({
      success: true,
      data: {
        id: card._id,
        ...card,
        amount: parseFloat(card.amount || 0),
        balance: parseFloat(card.balance || 0),
        transactions: transactionsWithOrders
      }
    });
  } catch (error) {
    console.error('Error fetching gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la carte cadeau',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const cardData = {
      code: code,
      amount: parseFloat(amount),
      balance: parseFloat(amount),
      expiry_date: expiry_date ? new Date(expiry_date) : null,
      status: 'active',
      used: false,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await giftCardsCollection.insertOne(cardData);
    const cardId = result.insertedId;

    // Create purchase transaction
    await transactionsCollection.insertOne({
      gift_card_id: cardId,
      amount: parseFloat(amount),
      transaction_type: 'purchase',
      notes: 'Carte cadeau créée',
      created_at: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Carte cadeau créée avec succès',
      data: {
        id: cardId,
        ...cardData,
        amount: parseFloat(amount),
        balance: parseFloat(amount)
      }
    });
  } catch (error) {
    console.error('Error creating gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la carte cadeau',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PUT /api/admin/gift-cards/:id - Update gift card
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, balance, expiry_date, status } = req.body;

    const giftCardsCollection = await getCollection('gift_cards');
    
    const updateData = {};
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (balance !== undefined) updateData.balance = parseFloat(balance);
    if (expiry_date !== undefined) updateData.expiry_date = expiry_date ? new Date(expiry_date) : null;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    updateData.updated_at = new Date();

    const result = await giftCardsCollection.updateOne(
      { _id: id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Carte cadeau non trouvée'
      });
    }

    const updated = await giftCardsCollection.findOne({ _id: id });
    res.json({
      success: true,
      message: 'Carte cadeau mise à jour',
      data: {
        id: updated._id,
        ...updated,
        amount: parseFloat(updated.amount || 0),
        balance: parseFloat(updated.balance || 0)
      }
    });
  } catch (error) {
    console.error('Error updating gift card:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la carte cadeau',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/gift-cards/:id - Delete gift card
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const giftCardsCollection = await getCollection('gift_cards');
    const result = await giftCardsCollection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/gift-cards/check/:code - Check gift card balance (public endpoint)
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

