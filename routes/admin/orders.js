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

// Permanent statuses that cannot be changed
const PERMANENT_STATUSES = ['cancelled', 'refunded'];

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
    
    // Get current order to check if it's in a permanent status
    const currentOrder = await ordersCollection.findOne({ _id: id });
    if (!currentOrder) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Check if order is in a permanent status
    if (PERMANENT_STATUSES.includes(currentOrder.status)) {
      return res.status(400).json({
        success: false,
        message: `Cette commande est ${currentOrder.status === 'refunded' ? 'remboursée' : 'annulée'} et ne peut plus être modifiée`
      });
    }

    // If status is being changed to 'cancelled', trigger refund
    if (status === 'cancelled') {
      // Import refund logic inline to avoid circular dependencies
      const giftCardsCollection = await getCollection('gift_cards');
      const giftCardTransactionsCollection = await getCollection('gift_card_transactions');
      
      const totalAmount = parseFloat(currentOrder.total);
      const giftCardAmount = parseFloat(currentOrder.gift_card_amount || 0);
      const squareAmount = totalAmount - giftCardAmount;
      
      let squareRefundResult = null;
      const refundDetails = {
        total_refunded: totalAmount,
        square_refunded: 0,
        gift_card_refunded: 0,
        methods: []
      };

      // Refund Square payment if applicable
      if (currentOrder.square_payment_id && squareAmount > 0) {
        try {
          squareRefundResult = await processRefund(
            currentOrder.square_payment_id,
            squareAmount,
            'ORDER_CANCELLED'
          );
          refundDetails.square_refunded = squareAmount;
          refundDetails.methods.push('Square');
        } catch (squareError) {
          console.error('Square refund failed during cancellation:', squareError.message);
          return res.status(500).json({
            success: false,
            message: 'Erreur lors du remboursement Square',
            error: squareError.message
          });
        }
      }

      // Restore gift card balance if applicable
      if (currentOrder.gift_card_code && giftCardAmount > 0) {
        try {
          const giftCard = await giftCardsCollection.findOne({ 
            code: currentOrder.gift_card_code.toUpperCase() 
          });

          if (giftCard) {
            const currentBalance = parseFloat(giftCard.balance || 0);
            const newBalance = currentBalance + giftCardAmount;

            await giftCardsCollection.updateOne(
              { _id: giftCard._id },
              {
                $set: {
                  balance: newBalance,
                  status: 'active',
                  used: false,
                  updated_at: new Date()
                }
              }
            );

            await giftCardTransactionsCollection.insertOne({
              gift_card_id: giftCard._id,
              order_id: id,
              amount: giftCardAmount,
              transaction_type: 'refund',
              notes: `Remboursement commande annulée #${id.substring(0, 8)}`,
              created_at: new Date()
            });

            refundDetails.gift_card_refunded = giftCardAmount;
            refundDetails.methods.push('Carte cadeau');
          }
        } catch (giftCardError) {
          console.error('Gift card refund failed during cancellation:', giftCardError);
        }
      }

      // Update order to cancelled with refund info
      await ordersCollection.updateOne(
        { _id: id },
        {
          $set: {
            status: 'cancelled',
            payment_status: 'refunded',
            refund_amount: totalAmount,
            refund_reason: 'Commande annulée',
            refunded_at: new Date(),
            refund_details: refundDetails,
            square_refund_id: squareRefundResult?.refundId || null,
            updated_at: new Date()
          }
        }
      );

      const updatedOrder = await ordersCollection.findOne({ _id: id });
      console.log(`✅ Order ${id} cancelled and refunded`);

      return res.json({
        success: true,
        message: 'Commande annulée et remboursée',
        data: {
          id: updatedOrder._id,
          ...updatedOrder
        }
      });
    }

    // For other status changes, just update status
    const result = await ordersCollection.updateOne(
      { _id: id },
      {
        $set: {
          status: status,
          updated_at: new Date()
        }
      }
    );

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

// PUT /api/admin/orders/:id/refund - Process full refund
router.put('/:id/refund', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const ordersCollection = await getCollection('orders');
    const giftCardsCollection = await getCollection('gift_cards');
    const giftCardTransactionsCollection = await getCollection('gift_card_transactions');
    
    // Get order
    const order = await ordersCollection.findOne({ _id: id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Check if order is already refunded or cancelled
    if (PERMANENT_STATUSES.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cette commande est déjà ${order.status === 'refunded' ? 'remboursée' : 'annulée'} et ne peut plus être modifiée`
      });
    }

    const totalAmount = parseFloat(order.total);
    const giftCardAmount = parseFloat(order.gift_card_amount || 0);
    const squareAmount = totalAmount - giftCardAmount; // Amount paid via Square
    
    let squareRefundResult = null;
    let giftCardRefundResult = null;
    const refundDetails = {
      total_refunded: totalAmount,
      square_refunded: 0,
      gift_card_refunded: 0,
      methods: []
    };

    console.log(`💰 Processing refund for order ${id}:`);
    console.log(`   Total: ${totalAmount}€`);
    console.log(`   Gift card: ${giftCardAmount}€`);
    console.log(`   Square: ${squareAmount}€`);

    // 1. Refund Square payment if applicable
    if (order.square_payment_id && squareAmount > 0) {
      try {
        console.log(`   🔄 Processing Square refund: ${squareAmount}€`);
        squareRefundResult = await processRefund(
          order.square_payment_id,
          squareAmount,
          reason || 'REQUESTED_BY_CUSTOMER'
        );
        refundDetails.square_refunded = squareAmount;
        refundDetails.methods.push('Square');
        console.log(`   ✅ Square refund successful: ${squareRefundResult.refundId}`);
      } catch (squareError) {
        console.error('   ❌ Square refund failed:', squareError.message);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors du remboursement Square',
          error: squareError.message
        });
      }
    }

    // 2. Restore gift card balance if applicable
    if (order.gift_card_code && giftCardAmount > 0) {
      try {
        console.log(`   🔄 Restoring gift card balance: ${giftCardAmount}€`);
        
        // Find the gift card
        const giftCard = await giftCardsCollection.findOne({ 
          code: order.gift_card_code.toUpperCase() 
        });

        if (giftCard) {
          const currentBalance = parseFloat(giftCard.balance || 0);
          const newBalance = currentBalance + giftCardAmount;

          // Update gift card balance
          await giftCardsCollection.updateOne(
            { _id: giftCard._id },
            {
              $set: {
                balance: newBalance,
                status: 'active', // Reactivate if it was 'used'
                used: false,
                updated_at: new Date()
              }
            }
          );

          // Record refund transaction
          await giftCardTransactionsCollection.insertOne({
            gift_card_id: giftCard._id,
            order_id: id,
            amount: giftCardAmount, // Positive for refund
            transaction_type: 'refund',
            notes: `Remboursement commande #${id.substring(0, 8)} - ${reason || 'Demande client'}`,
            created_at: new Date()
          });

          giftCardRefundResult = {
            code: giftCard.code,
            previousBalance: currentBalance,
            newBalance: newBalance
          };
          refundDetails.gift_card_refunded = giftCardAmount;
          refundDetails.methods.push('Carte cadeau');
          console.log(`   ✅ Gift card ${giftCard.code} balance restored: ${currentBalance}€ → ${newBalance}€`);
        } else {
          console.warn(`   ⚠️ Gift card ${order.gift_card_code} not found - skipping gift card refund`);
        }
      } catch (giftCardError) {
        console.error('   ❌ Gift card refund failed:', giftCardError.message);
        // Don't fail the entire refund if gift card restore fails, but log it
        // The Square refund was already processed, so we continue
      }
    }

    // 3. Update order status
    await ordersCollection.updateOne(
      { _id: id },
      {
        $set: {
          refund_amount: totalAmount,
          refund_reason: reason || 'Demande client',
          refunded_at: new Date(),
          status: 'refunded',
          payment_status: 'refunded',
          refund_details: refundDetails,
          square_refund_id: squareRefundResult?.refundId || null,
          updated_at: new Date()
        }
      }
    );

    console.log(`✅ Order ${id} fully refunded`);

    res.json({
      success: true,
      message: 'Remboursement effectué avec succès',
      data: {
        order_id: id,
        total_refunded: totalAmount,
        refund_details: refundDetails,
        square_refund: squareRefundResult,
        gift_card_refund: giftCardRefundResult
      }
    });

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

