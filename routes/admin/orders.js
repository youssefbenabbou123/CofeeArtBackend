import express from 'express';
import pool from '../../db.js';
import { verifyToken, requireAdmin } from '../../middleware/auth.js';
import { generateInvoicePDF } from '../../services/pdf.js';
import { processRefund } from '../../services/stripe.js';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// GET /api/admin/orders - List orders with filters
router.get('/', async (req, res) => {
  try {
    const { status, payment_status, start_date, end_date, search } = req.query;

    let query = `
      SELECT 
        o.id,
        o.user_id,
        o.guest_name,
        o.guest_email,
        o.total,
        o.status,
        o.payment_status,
        o.payment_method,
        o.shipping_method,
        o.created_at,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND o.status = $${paramCount++}`;
      params.push(status);
    }

    if (payment_status) {
      query += ` AND o.payment_status = $${paramCount++}`;
      params.push(payment_status);
    }

    if (start_date) {
      query += ` AND o.created_at >= $${paramCount++}`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND o.created_at <= $${paramCount++}`;
      params.push(end_date);
    }

    if (search) {
      query += ` AND (
        o.guest_name ILIKE $${paramCount} OR 
        o.guest_email ILIKE $${paramCount} OR
        o.id::text ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes',
      error: error.message
    });
  }
});

// GET /api/admin/orders/:id - Get order details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    const order = orderResult.rows[0];

    // Get order items with product details
    const itemsResult = await pool.query(
      `SELECT 
        oi.id,
        oi.quantity,
        oi.price,
        p.id as product_id,
        p.title,
        p.image
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...order,
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la commande',
      error: error.message
    });
  }
});

// PUT /api/admin/orders/:id/status - Update order status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Le statut est requis'
      });
    }

    const validStatuses = ['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Statut invalide. Statuts valides: ${validStatuses.join(', ')}`
      });
    }

    // Check if updated_at column exists, if not, just update status
    let result;
    try {
      // Try with updated_at first
      result = await pool.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [status, id]
      );
    } catch (err) {
      // If updated_at doesn't exist, update without it
      if (err.message && err.message.includes('updated_at')) {
        console.log('updated_at column not found, updating without it');
        result = await pool.query(
          'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
          [status, id]
        );
      } else {
        throw err;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    console.log(`✅ Order ${id} status updated to: ${status}`);

    res.json({
      success: true,
      message: 'Statut de la commande mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail
    });
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut',
      error: error.message
    });
  }
});

// PUT /api/admin/orders/:id/refund - Process refund
router.put('/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    // Get order
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    const order = orderResult.rows[0];
    const refundAmount = amount || parseFloat(order.total);

    // Process Stripe refund if payment was made via Stripe
    if (order.stripe_payment_intent_id) {
      try {
        const refundResult = await processRefund(
          order.stripe_payment_intent_id,
          refundAmount,
          reason || 'requested_by_customer'
        );

        // Update order
        await pool.query(
          `UPDATE orders 
           SET refund_amount = $1, 
               refund_reason = $2, 
               refunded_at = NOW(),
               status = 'refunded',
               payment_status = 'refunded'
           WHERE id = $3`,
          [refundAmount, reason, id]
        );

        res.json({
          success: true,
          message: 'Remboursement effectué',
          data: {
            refundId: refundResult.refundId,
            amount: refundAmount
          }
        });
      } catch (stripeError) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors du remboursement Stripe',
          error: stripeError.message
        });
      }
    } else {
      // Manual refund (no Stripe)
      await pool.query(
        `UPDATE orders 
         SET refund_amount = $1, 
             refund_reason = $2, 
             refunded_at = NOW(),
             status = 'refunded'
         WHERE id = $3`,
        [refundAmount, reason, id]
      );

      res.json({
        success: true,
        message: 'Remboursement enregistré (manuel)',
        data: { amount: refundAmount }
      });
    }
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du remboursement',
      error: error.message
    });
  }
});

// GET /api/admin/orders/:id/invoice - Generate PDF invoice
router.get('/:id/invoice', async (req, res) => {
  try {
    const { id } = req.params;

    // Get order with items
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    const order = orderResult.rows[0];

    // Get order items
    const itemsResult = await pool.query(
      `SELECT 
        oi.quantity,
        oi.price,
        p.title
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [id]
    );

    const orderData = {
      ...order,
      orderId: order.id, // Add orderId for PDF compatibility
      createdAt: order.created_at, // Add createdAt for PDF compatibility
      items: itemsResult.rows,
      customerName: order.guest_name,
      customerEmail: order.guest_email,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      stripe_payment_intent_id: order.stripe_payment_intent_id
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(orderData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${id.substring(0, 8)}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération de la facture',
      error: error.message
    });
  }
});

// GET /api/admin/orders/export - Export orders to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        o.id,
        o.guest_name as customer_name,
        o.guest_email as customer_email,
        o.total,
        o.status,
        o.payment_status,
        o.created_at,
        COUNT(oi.id) as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (start_date) {
      query += ` AND o.created_at >= $${paramCount++}`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND o.created_at <= $${paramCount++}`;
      params.push(end_date);
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);

    // Create CSV manually with proper formatting
    const headers = ['ID', 'Nom client', 'Email', 'Total', 'Statut', 'Statut paiement', 'Nb articles', 'Date'];
    const csvRows = [headers.join(',')];

    result.rows.forEach(row => {
      const values = [
        row.id,
        `"${(row.customer_name || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        `"${(row.customer_email || '').replace(/"/g, '""')}"`,
        parseFloat(row.total || 0).toFixed(2),
        row.status || '',
        row.payment_status || '',
        row.item_count || 0,
        new Date(row.created_at).toLocaleDateString('fr-FR')
      ];
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    
    // Set proper headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="commandes-${new Date().toISOString().split('T')[0]}.csv"`);
    
    // Add BOM for Excel compatibility (UTF-8)
    res.write('\ufeff');
    res.end(csvContent);
  } catch (error) {
    console.error('Error exporting orders:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export',
      error: error.message
    });
  }
});

export default router;

