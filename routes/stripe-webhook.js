import express from 'express';
import Stripe from 'stripe';
import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !webhookSecret) {
    console.warn('⚠️  Stripe webhook secret not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // Handle gift card purchase
        if (session.metadata?.gift_card_id) {
          const giftCardId = session.metadata.gift_card_id;
          const code = session.metadata.gift_card_code;
          const recipientEmail = session.metadata.recipient_email;
          
          // Update gift card status (already created, just mark as paid)
          await pool.query(
            `UPDATE gift_cards 
             SET status = 'active', updated_at = NOW()
             WHERE id = $1`,
            [giftCardId]
          );

          // TODO: Send email to recipient with code
          console.log(`✅ Gift card ${code} purchased successfully. Email should be sent to ${recipientEmail}`);
        }
        
        // Handle workshop booking
        if (session.metadata?.type === 'workshop_booking' && session.metadata?.reservation_id) {
          const reservationId = session.metadata.reservation_id;
          const client = await pool.connect();
          
          try {
            await client.query('BEGIN');
            
            // Update reservation status to confirmed
            await client.query(
              `UPDATE reservations 
               SET status = 'confirmed', updated_at = NOW()
               WHERE id = $1 AND status = 'pending'`,
              [reservationId]
            );

            // Get reservation details
            const reservation = await client.query(
              'SELECT session_id, quantity FROM reservations WHERE id = $1',
              [reservationId]
            );

            if (reservation.rows.length > 0) {
              // booked_count was already incremented when reservation was created
              // Just confirm the reservation status (booked_count already updated)

              // Get workshop and session details for email
              const workshopResult = await client.query(
                `SELECT w.*, ws.session_date, ws.session_time 
                 FROM workshops w
                 JOIN reservations r ON r.workshop_id = w.id
                 JOIN workshop_sessions ws ON r.session_id = ws.id
                 WHERE r.id = $1`,
                [reservationId]
              );

              if (workshopResult.rows.length > 0) {
                const workshop = workshopResult.rows[0];
                const email = session.metadata.guest_email || null;
                const guestName = session.metadata.guest_name || 'Participant';

                // Send confirmation email
                if (email) {
                  try {
                    const { sendWorkshopConfirmation } = await import('../services/email.js');
                    await sendWorkshopConfirmation(email, {
                      participantName: guestName,
                      workshopTitle: workshop.title,
                      sessionDate: workshop.session_date,
                      sessionTime: workshop.session_time,
                      duration: workshop.duration,
                      level: workshop.level
                    });
                  } catch (emailError) {
                    console.error('Error sending workshop confirmation email:', emailError);
                    // Don't fail the reservation if email fails
                  }
                }
              }
            }

            await client.query('COMMIT');
            console.log(`✅ Workshop reservation ${reservationId} confirmed after payment`);
          } catch (error) {
            await client.query('ROLLBACK');
            console.error(`❌ Error confirming workshop reservation ${reservationId}:`, error);
            throw error;
          } finally {
            client.release();
          }
        }
        
        // Handle order payment
        if (session.metadata?.order_id) {
          const orderId = session.metadata.order_id;
          
          await pool.query(
            `UPDATE orders 
             SET payment_status = 'paid', 
                 stripe_payment_intent_id = $1,
                 payment_method = 'Stripe',
                 status = 'confirmed',
                 updated_at = NOW()
             WHERE id = $2`,
            [session.payment_intent, orderId]
          );

          console.log(`✅ Order ${orderId} payment confirmed`);
        }
        
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('✅ PaymentIntent succeeded:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.error('❌ Payment failed:', failedPayment.id);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;


