import express from 'express';
import { getCollection } from '../../db-mongodb.js';
import { verifyToken, requireAdmin } from '../../middleware/auth.js';
import { generateInvoicePDF } from '../../services/pdf.js';
import { processRefund } from '../../services/square.js';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// GET /api/admin/orders - List orders with filters
router.get('/', async (req, res) => {
  try {
    const { status, payment_status, start_date, end_date, search } = req.query;

    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');

    // Build MongoDB query
    const query = {};
    if (status) query.status = status;
    if (payment_status) query.payment_status = payment_status;
    if (start_date || end_date) {
      query.created_at = {};
      if (start_date) query.created_at.$gte = new Date(start_date);
      if (end_date) query.created_at.$lte = new Date(end_date);
    }
    if (search) {
      query.$or = [
        { guest_name: { $regex: search, $options: 'i' } },
        { guest_email: { $regex: search, $options: 'i' } },
        { _id: { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await ordersCollection.find(query)
      .sort({ created_at: -1 })
      .toArray();

    // Get item counts for each order
    const ordersWithCounts = await Promise.all(orders.map(async (order) => {
      const itemCount = await orderItemsCollection.countDocuments({ order_id: order._id });
      return {
        id: order._id,
        user_id: order.user_id,
        guest_name: order.guest_name,
        guest_email: order.guest_email,
        total: order.total,
        status: order.status,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
        shipping_method: order.shipping_method,
        created_at: order.created_at,
        item_count: itemCount
      };
    }));

    res.json({
      success: true,
      data: ordersWithCounts
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/orders/:id - Get order details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');
    const productsCollection = await getCollection('products');

    // Get order
    const order = await ordersCollection.findOne({ _id: id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Get order items with product details
    const orderItems = await orderItemsCollection.find({ order_id: id }).toArray();
    const items = await Promise.all(orderItems.map(async (oi) => {
      const product = await productsCollection.findOne({ _id: oi.product_id });
      return {
        id: oi._id,
        quantity: oi.quantity,
        price: oi.price,
        product_id: oi.product_id,
        title: product?.title || null,
        image: product?.image || null
      };
    }));

    res.json({
      success: true,
      data: {
        id: order._id,
        ...order,
        items: items
      }
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la commande',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const ordersCollection = await getCollection('orders');
    const result = await ordersCollection.updateOne(
      { _id: id },
      {
        $set: {
          status: status,
          updated_at: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    const updatedOrder = await ordersCollection.findOne({ _id: id });
    console.log(`✅ Order ${id} status updated to: ${status}`);

    res.json({
      success: true,
      message: 'Statut de la commande mis à jour',
      data: {
        id: updatedOrder._id,
        ...updatedOrder
      }
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PUT /api/admin/orders/:id/refund - Process refund
router.put('/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const ordersCollection = await getCollection('orders');
    
    // Get order
    const order = await ordersCollection.findOne({ _id: id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }
    const refundAmount = amount || parseFloat(order.total);

    // Process Square refund if payment was made via Square
    if (order.square_payment_id) {
      try {
        const refundResult = await processRefund(
          order.square_payment_id,
          refundAmount,
          reason || 'REQUESTED_BY_CUSTOMER'
        );

        // Update order
        await ordersCollection.updateOne(
          { _id: id },
          {
            $set: {
              refund_amount: refundAmount,
              refund_reason: reason,
              refunded_at: new Date(),
              status: 'refunded',
              payment_status: 'refunded'
            }
          }
        );

        res.json({
          success: true,
          message: 'Remboursement effectué',
          data: {
            refundId: refundResult.refundId,
            amount: refundAmount
          }
        });
      } catch (squareError) {
        return res.status(500).json({
          success: false,
          message: 'Erreur lors du remboursement Square',
          error: squareError.message
        });
      }
    } else {
      // Manual refund (no Stripe)
      await ordersCollection.updateOne(
        { _id: id },
        {
          $set: {
            refund_amount: refundAmount,
            refund_reason: reason,
            refunded_at: new Date(),
            status: 'refunded'
          }
        }
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/orders/:id/invoice - Generate PDF invoice
router.get('/:id/invoice', async (req, res) => {
  try {
    const { id } = req.params;

    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');
    const productsCollection = await getCollection('products');

    // Get order with items
    const order = await ordersCollection.findOne({ _id: id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Get order items
    const orderItems = await orderItemsCollection.find({ order_id: id }).toArray();
    const items = await Promise.all(orderItems.map(async (oi) => {
      const product = await productsCollection.findOne({ _id: oi.product_id });
      return {
        quantity: oi.quantity,
        price: oi.price,
        title: product?.title || null
      };
    }));

    const orderData = {
      ...order,
      orderId: order.id, // Add orderId for PDF compatibility
      createdAt: order.created_at, // Add createdAt for PDF compatibility
      items: items,
      customerName: order.guest_name,
      customerEmail: order.guest_email,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      square_payment_id: order.square_payment_id
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/orders/export - Export orders to CSV
router.get('/export/csv', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');

    const query = {};
    if (start_date || end_date) {
      query.created_at = {};
      if (start_date) query.created_at.$gte = new Date(start_date);
      if (end_date) query.created_at.$lte = new Date(end_date);
    }

    const orders = await ordersCollection.find(query)
      .sort({ created_at: -1 })
      .toArray();

    const ordersWithCounts = await Promise.all(orders.map(async (order) => {
      const itemCount = await orderItemsCollection.countDocuments({ order_id: order._id });
      return {
        id: order._id,
        customer_name: order.guest_name,
        customer_email: order.guest_email,
        total: order.total,
        status: order.status,
        payment_status: order.payment_status,
        created_at: order.created_at,
        item_count: itemCount
      };
    }));

    const result = { rows: ordersWithCounts };

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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

