import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Stripe
let stripe = null;
let stripeInitError = null;

const stripeKey = process.env.STRIPE_SECRET_KEY;

if (stripeKey) {
  // Validate key format
  if (!stripeKey.startsWith('sk_test_') && !stripeKey.startsWith('sk_live_')) {
    stripeInitError = 'Invalid Stripe secret key format. Must start with sk_test_ or sk_live_';
    console.error('❌ Stripe initialization failed:', stripeInitError);
    console.error('   Current key prefix:', stripeKey.substring(0, 15) + '...');
  } else {
    try {
      stripe = new Stripe(stripeKey);
      console.log('✅ Stripe initialized successfully');
      console.log('   Key type:', stripeKey.startsWith('sk_test_') ? 'TEST' : 'LIVE');
      console.log('   Key prefix:', stripeKey.substring(0, 20) + '...');
    } catch (error) {
      stripeInitError = error.message;
      console.error('❌ Error initializing Stripe:', error.message);
      console.error('   Error type:', error.type || 'Unknown');
      if (error.stack) {
        console.error('   Stack trace:', error.stack);
      }
    }
  }
} else {
  stripeInitError = 'STRIPE_SECRET_KEY not set';
  console.warn('⚠️  STRIPE_SECRET_KEY not set. Payment functionality will be disabled.');
  console.warn('   Please add STRIPE_SECRET_KEY to your .env file and restart the server.');
  console.warn('   For deployed services, add it to environment variables in your hosting platform.');
}

/**
 * Create a payment intent
 * @param {number} amount - Amount in euros
 * @param {string} currency - Currency code (default: 'eur')
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Payment intent
 */
export async function createPaymentIntent(amount, currency = 'eur', metadata = {}) {
  if (!stripe) {
    const errorMsg = stripeInitError 
      ? `Stripe is not configured: ${stripeInitError}` 
      : 'Stripe is not configured. Please set STRIPE_SECRET_KEY.';
    throw new Error(errorMsg);
  }

  try {
    // Convert euros to cents
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
}

/**
 * Process a refund
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {number} amount - Amount to refund in euros (optional, full refund if not provided)
 * @param {string} reason - Refund reason
 * @returns {Promise<Object>} Refund object
 */
export async function processRefund(paymentIntentId, amount = null, reason = 'requested_by_customer') {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
  }

  try {
    const refundParams = {
      payment_intent: paymentIntentId,
      reason,
    };

    if (amount) {
      // Convert euros to cents
      refundParams.amount = Math.round(amount * 100);
    }

    const refund = await stripe.refunds.create(refundParams);

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100, // Convert cents to euros
      status: refund.status,
    };
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
}

/**
 * Verify webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Object} Event object
 */
export async function verifyWebhook(payload, signature) {
  if (!stripe) {
    throw new Error('Stripe is not configured.');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET not set.');
  }

  try {
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return event;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    throw error;
  }
}

// Export stripe instance and initialization status
export { stripe, stripeInitError };

