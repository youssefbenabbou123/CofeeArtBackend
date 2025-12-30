import express from 'express';
import { createPayment, getLocationId } from '../services/square.js';
import { getCollection } from '../db-mongodb.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// GET /api/square/check-config
// Check if Square is configured
router.get('/check-config', (req, res) => {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const applicationId = process.env.SQUARE_APPLICATION_ID;
    const hasAccessToken = !!accessToken;
    const hasApplicationId = !!applicationId;
    let configured = false;
    let environment = process.env.SQUARE_ENVIRONMENT || 'sandbox';
    let error = null;

    if (hasAccessToken && hasApplicationId) {
        configured = true;
    } else {
        error = 'SQUARE_ACCESS_TOKEN or SQUARE_APPLICATION_ID not set';
    }

    res.json({
        success: true,
        configured: configured,
        hasAccessToken: hasAccessToken,
        hasApplicationId: hasApplicationId,
        environment: environment,
        applicationIdPrefix: hasApplicationId ? applicationId.substring(0, 20) + '...' : null,
        error: error
    });
});

// POST /api/square/create-payment
// Creates a Square payment
router.post('/create-payment', async (req, res) => {
    try {
        const { sourceId, amount, currency = 'EUR', idempotencyKey, metadata = {} } = req.body;

        if (!sourceId) {
            return res.status(400).json({
                success: false,
                message: 'Source ID is required'
            });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Montant invalide'
            });
        }

        if (!idempotencyKey) {
            return res.status(400).json({
                success: false,
                message: 'Idempotency key is required'
            });
        }

        const result = await createPayment(sourceId, amount, currency, idempotencyKey, metadata);

        res.json({
            success: true,
            paymentId: result.paymentId,
            status: result.status
        });
    } catch (error) {
        console.error('Error creating payment:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erreur lors de la création du paiement'
        });
    }
});

// POST /api/square/confirm-payment
// Updates order status after successful payment
router.post('/confirm-payment', async (req, res) => {
    try {
        const { orderId, paymentId } = req.body;

        if (!orderId || !paymentId) {
            return res.status(400).json({
                success: false,
                message: 'Données manquantes'
            });
        }

        // Update order payment status
        const ordersCollection = await getCollection('orders');
        await ordersCollection.updateOne(
            { _id: orderId },
            {
                $set: {
                    payment_status: 'paid',
                    square_payment_id: paymentId,
                    payment_method: 'Square',
                    status: 'confirmed',
                    updated_at: new Date()
                }
            }
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

