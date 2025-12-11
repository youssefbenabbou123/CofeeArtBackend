import express from 'express';
import { createPaymentIntent } from '../services/stripe.js';
import pool from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// GET /api/stripe/check-config
// Check if Stripe is configured
router.get('/check-config', (req, res) => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const hasSecretKey = !!stripeKey;
    let configured = false;
    let keyType = null;
    let error = null;

    if (hasSecretKey) {
        if (stripeKey.startsWith('sk_test_')) {
            configured = true;
            keyType = 'test';
        } else if (stripeKey.startsWith('sk_live_')) {
            configured = true;
            keyType = 'live';
        } else {
            error = 'Invalid key format. Must start with sk_test_ or sk_live_';
        }
    } else {
        error = 'STRIPE_SECRET_KEY not set';
    }

    res.json({
        success: true,
        configured: configured,
        hasSecretKey: hasSecretKey,
        keyType: keyType,
        keyPrefix: hasSecretKey ? stripeKey.substring(0, 20) + '...' : null,
        error: error
    });
});

// POST /api/stripe/create-payment-intent
// Creates a Stripe payment intent for the checkout
router.post('/create-payment-intent', async (req, res) => {
    try {
        const { amount, currency = 'eur', metadata = {} } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Montant invalide'
            });
        }

        const result = await createPaymentIntent(amount, currency, metadata);

        res.json({
            success: true,
            clientSecret: result.clientSecret,
            paymentIntentId: result.paymentIntentId
        });
    } catch (error) {
        console.error('Error creating payment intent:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erreur lors de la création du paiement'
        });
    }
});

// POST /api/stripe/confirm-payment
// Updates order status after successful payment
router.post('/confirm-payment', async (req, res) => {
    try {
        const { orderId, paymentIntentId } = req.body;

        if (!orderId || !paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: 'Données manquantes'
            });
        }

        // Update order payment status
        await pool.query(
            `UPDATE orders 
       SET payment_status = 'paid', 
           stripe_payment_intent_id = $1,
           payment_method = 'Stripe',
           status = 'confirmed',
           updated_at = NOW()
       WHERE id = $2`,
            [paymentIntentId, orderId]
        );
        
        console.log(`✅ Order ${orderId} payment confirmed - status updated to paid`);

        res.json({
            success: true,
            message: 'Paiement confirmé'
        });
    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors de la confirmation du paiement'
        });
    }
});

export default router;
