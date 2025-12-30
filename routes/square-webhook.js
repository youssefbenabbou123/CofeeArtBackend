import express from 'express';
import crypto from 'crypto';
import { getCollection } from '../db-mongodb.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

/**
 * Verify Square webhook signature
 * @param {string} body - Raw request body
 * @param {string} signature - Square signature from header
 * @param {string} url - Webhook URL
 * @returns {boolean} - Whether signature is valid
 */
function verifySquareSignature(body, signature, url) {
  if (!webhookSignatureKey) {
    console.warn('⚠️  SQUARE_WEBHOOK_SIGNATURE_KEY not configured - skipping verification');
    return true; // Allow in development without key
  }

  try {
    const hmac = crypto.createHmac('sha256', webhookSignatureKey);
    const toSign = url + body;
    const expectedSignature = 'sha256=' + hmac.update(toSign).digest('base64');
    return signature === expectedSignature;
  } catch (error) {
    console.error('Error verifying Square signature:', error);
    return false;
  }
}

// Square webhook endpoint
router.post('/webhook', express.json(), async (req, res) => {
  const signature = req.headers['x-square-hmacsha256-signature'];
  const body = JSON.stringify(req.body);
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  // Verify signature in production
  if (process.env.NODE_ENV === 'production' && webhookSignatureKey) {
    if (!verifySquareSignature(body, signature, url)) {
      console.error('❌ Square webhook signature verification failed');
      return res.status(401).send('Invalid signature');
    }
  }

  const event = req.body;
  console.log('📥 Square webhook received:', event.type);

  try {
    switch (event.type) {
      case 'payment.completed':
        await handlePaymentCompleted(event.data.object);
        break;

      case 'payment.updated':
        await handlePaymentUpdated(event.data.object);
        break;

      case 'order.updated':
        await handleOrderUpdated(event.data.object);
        break;

      case 'checkout.completed':
        await handleCheckoutCompleted(event.data);
        break;

      default:
        console.log(`ℹ️  Unhandled Square event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Error handling Square webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handle payment.completed event
 */
async function handlePaymentCompleted(payment) {
  console.log('✅ Square payment completed:', payment.id);
  
  const ordersCollection = await getCollection('orders');
  const giftCardsCollection = await getCollection('gift_cards');
  const giftCardTransactionsCollection = await getCollection('gift_card_transactions');

  // Find order by Square payment ID
  const order = await ordersCollection.findOne({ 
    square_payment_id: payment.id 
  });

  if (!order) {
    console.log('ℹ️  No order found for payment:', payment.id);
    return;
  }

  // Update order status
  await ordersCollection.updateOne(
    { _id: order._id },
    {
      $set: {
        payment_status: 'paid',
        status: 'confirmed',
        updated_at: new Date()
      }
    }
  );

  // If there was a gift card applied (partial payment), redeem it now
  if (order.gift_card_code && order.gift_card_amount > 0) {
    const card = await giftCardsCollection.findOne({ 
      code: order.gift_card_code.toUpperCase() 
    });

    if (card) {
      const currentBalance = parseFloat(card.balance || 0);
      const amountToDeduct = parseFloat(order.gift_card_amount);
      const newBalance = Math.max(0, currentBalance - amountToDeduct);
      const newStatus = newBalance <= 0 ? 'used' : 'active';

      // Deduct from gift card
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
      await giftCardTransactionsCollection.insertOne({
        gift_card_id: card._id,
        order_id: order._id,
        amount: -amountToDeduct,
        transaction_type: 'usage',
        notes: `Commande #${order._id} (après paiement Square)`,
        created_at: new Date()
      });

      console.log(`✅ Gift card ${order.gift_card_code} redeemed after payment: ${amountToDeduct}€`);
    }
  }

  console.log(`✅ Order ${order._id} marked as paid`);
}

/**
 * Handle payment.updated event
 */
async function handlePaymentUpdated(payment) {
  console.log('ℹ️  Square payment updated:', payment.id, 'Status:', payment.status);
  
  if (payment.status === 'COMPLETED') {
    await handlePaymentCompleted(payment);
  } else if (payment.status === 'FAILED' || payment.status === 'CANCELED') {
    const ordersCollection = await getCollection('orders');
    
    // Find and update order
    await ordersCollection.updateOne(
      { square_payment_id: payment.id },
      {
        $set: {
          payment_status: payment.status === 'FAILED' ? 'failed' : 'cancelled',
          updated_at: new Date()
        }
      }
    );

    console.log(`⚠️  Payment ${payment.id} ${payment.status.toLowerCase()}`);
  }
}

/**
 * Handle order.updated event (Square Order, not our order)
 */
async function handleOrderUpdated(squareOrder) {
  console.log('ℹ️  Square order updated:', squareOrder.id, 'State:', squareOrder.state);
  
  // Square orders have states like OPEN, COMPLETED, CANCELED
  if (squareOrder.state === 'COMPLETED') {
    // Find our order by Square order ID if we stored it
    const ordersCollection = await getCollection('orders');
    
    // Try to find by tenders (payments) in the Square order
    if (squareOrder.tenders && squareOrder.tenders.length > 0) {
      for (const tender of squareOrder.tenders) {
        const order = await ordersCollection.findOne({ 
          square_payment_id: tender.id 
        });
        
        if (order && order.payment_status !== 'paid') {
          await ordersCollection.updateOne(
            { _id: order._id },
            {
              $set: {
                payment_status: 'paid',
                status: 'confirmed',
                updated_at: new Date()
              }
            }
          );
          console.log(`✅ Order ${order._id} confirmed via Square order completion`);
        }
      }
    }
  }
}

/**
 * Handle checkout.completed event (Payment Link checkout)
 * Handles both product orders and workshop reservations
 */
async function handleCheckoutCompleted(data) {
  console.log('✅ Square checkout completed');
  
  const checkout = data.object?.checkout || data.checkout;
  if (!checkout) {
    console.log('ℹ️  No checkout data in event');
    return;
  }

  const ordersCollection = await getCollection('orders');
  const reservationsCollection = await getCollection('reservations');
  const giftCardsCollection = await getCollection('gift_cards');
  const giftCardTransactionsCollection = await getCollection('gift_card_transactions');

  // First, try to find an order by checkout ID
  const order = await ordersCollection.findOne({ 
    square_payment_id: checkout.id 
  });

  // If no order found, try to find a workshop reservation
  if (!order) {
    const reservation = await reservationsCollection.findOne({
      square_checkout_id: checkout.id
    });

    if (reservation) {
      console.log('✅ Found workshop reservation for checkout:', checkout.id);
      
      // Get the payment ID from checkout for refunds
      const paymentId = checkout.order?.tenders?.[0]?.id || checkout.id;
      
      // Update reservation status to confirmed
      await reservationsCollection.updateOne(
        { _id: reservation._id },
        {
          $set: {
            status: 'confirmed',
            payment_status: 'paid',
            square_payment_id: paymentId,
            payment_confirmed_at: new Date(),
            updated_at: new Date()
          }
        }
      );

      // If there was a gift card applied (partial payment), redeem it now
      if (reservation.gift_card_code && reservation.gift_card_amount > 0) {
        const card = await giftCardsCollection.findOne({ 
          code: reservation.gift_card_code.toUpperCase() 
        });

        if (card) {
          const currentBalance = parseFloat(card.balance || 0);
          const amountToDeduct = parseFloat(reservation.gift_card_amount);
          const newBalance = Math.max(0, currentBalance - amountToDeduct);
          const newStatus = newBalance <= 0 ? 'used' : 'active';

          // Deduct from gift card
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
          await giftCardTransactionsCollection.insertOne({
            gift_card_id: card._id,
            reservation_id: reservation._id,
            amount: -amountToDeduct,
            transaction_type: 'usage',
            notes: `Réservation atelier #${reservation._id} (après paiement Square)`,
            created_at: new Date()
          });

          console.log(`✅ Gift card ${reservation.gift_card_code} redeemed for workshop: ${amountToDeduct}€`);
        }
      }

      console.log(`✅ Workshop reservation ${reservation._id} confirmed and paid`);
      return;
    }

    console.log('ℹ️  No order or reservation found for checkout:', checkout.id);
    return;
  }

  // Update order status
  await ordersCollection.updateOne(
    { _id: order._id },
    {
      $set: {
        payment_status: 'paid',
        status: 'confirmed',
        updated_at: new Date()
      }
    }
  );

  // Handle gift card redemption for partial payments
  if (order.gift_card_code && order.gift_card_amount > 0) {
    const card = await giftCardsCollection.findOne({ 
      code: order.gift_card_code.toUpperCase() 
    });

    if (card && card.status === 'active') {
      const currentBalance = parseFloat(card.balance || 0);
      const amountToDeduct = parseFloat(order.gift_card_amount);
      const newBalance = Math.max(0, currentBalance - amountToDeduct);
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

      await giftCardTransactionsCollection.insertOne({
        gift_card_id: card._id,
        order_id: order._id,
        amount: -amountToDeduct,
        transaction_type: 'usage',
        notes: `Commande #${order._id} (après paiement checkout)`,
        created_at: new Date()
      });

      console.log(`✅ Gift card ${order.gift_card_code} redeemed: ${amountToDeduct}€`);
    }
  }

  console.log(`✅ Order ${order._id} payment confirmed via checkout`);
}

export default router;

