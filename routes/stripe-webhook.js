import express from 'express';
import Stripe from 'stripe';
import { getCollection } from '../db-mongodb.js';
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
          const giftCardsCollection = await getCollection('gift_cards');
          await giftCardsCollection.updateOne(
            { _id: giftCardId },
            {
              $set: {
                status: 'active',
                updated_at: new Date()
              }
            }
          );

          // TODO: Send email to recipient with code
          console.log(`✅ Gift card ${code} purchased successfully. Email should be sent to ${recipientEmail}`);
        }
        
        // Handle workshop booking
        if (session.metadata?.type === 'workshop_booking' && session.metadata?.reservation_id) {
          const reservationId = session.metadata.reservation_id;
          const reservationsCollection = await getCollection('reservations');
          const workshopsCollection = await getCollection('workshops');
          const sessionsCollection = await getCollection('workshop_sessions');
          
          try {
            // Update reservation status to confirmed
            await reservationsCollection.updateOne(
              { _id: reservationId, status: 'pending' },
              {
                $set: {
                  status: 'confirmed',
                  updated_at: new Date()
                }
              }
            );

            // Get reservation details
            const reservation = await reservationsCollection.findOne({ _id: reservationId });

            if (reservation) {
              // booked_count was already incremented when reservation was created
              // Just confirm the reservation status (booked_count already updated)

              // Get workshop and session details for email
              const workshop = await workshopsCollection.findOne({ _id: reservation.workshop_id });
              const sessionData = await sessionsCollection.findOne({ _id: reservation.session_id });

              if (workshop && sessionData) {
                const email = session.metadata.guest_email || null;
                const guestName = session.metadata.guest_name || 'Participant';

                // Send confirmation email
                if (email) {
                  try {
                    const { sendWorkshopConfirmation } = await import('../services/email.js');
                    await sendWorkshopConfirmation(email, {
                      participantName: guestName,
                      workshopTitle: workshop.title,
                      sessionDate: sessionData.session_date,
                      sessionTime: sessionData.session_time,
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

            console.log(`✅ Workshop reservation ${reservationId} confirmed after payment`);
          } catch (error) {
            console.error(`❌ Error confirming workshop reservation ${reservationId}:`, error);
            throw error;
          }
        }
        
        // Handle order payment
        if (session.metadata?.order_id) {
          const orderId = session.metadata.order_id;
          const ordersCollection = await getCollection('orders');
          
          await ordersCollection.updateOne(
            { _id: orderId },
            {
              $set: {
                payment_status: 'paid',
                stripe_payment_intent_id: session.payment_intent,
                payment_method: 'Stripe',
                status: 'confirmed',
                updated_at: new Date()
              }
            }
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


