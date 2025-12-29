import express from 'express';
import { getCollection } from '../../db-mongodb.js';
import { verifyToken, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// Helper function to sync client from order/workshop
async function syncClient(data) {
  const { name, email, phone, address, city, postal_code, country } = data;
  
  if (!email) return null;

  const clientsCollection = await getCollection('clients');
  
  // Check if client exists
  const existing = await clientsCollection.findOne({ email: email.toLowerCase() });

  if (existing) {
    // Update client stats
    await clientsCollection.updateOne(
      { _id: existing._id },
      {
        $inc: { total_orders: 1 },
        $set: {
          last_order_date: new Date(),
          updated_at: new Date()
        }
      }
    );
    return existing._id;
  } else {
    // Create new client
    const clientData = {
      name,
      email: email.toLowerCase(),
      phone: phone || null,
      address: address || null,
      city: city || null,
      postal_code: postal_code || null,
      country: country || 'France',
      total_orders: 1,
      total_spent: 0,
      last_order_date: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    };
    const result = await clientsCollection.insertOne(clientData);
    return result.insertedId;
  }
}

// GET /api/admin/clients - List clients with search
router.get('/', async (req, res) => {
  try {
    const { search, sort = 'last_order_date', order = 'DESC' } = req.query;

    const clientsCollection = await getCollection('clients');
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const validSorts = ['name', 'email', 'last_order_date', 'total_orders', 'total_spent', 'created_at'];
    const sortField = validSorts.includes(sort) ? sort : 'last_order_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 1 : -1;

    const clients = await clientsCollection.find(query)
      .sort({ [sortField]: sortOrder })
      .toArray();

    res.json({
      success: true,
      data: clients.map(client => ({
        id: client._id,
        ...client,
        total_spent: parseFloat(client.total_spent || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des clients',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/clients/:id - Get client details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const clientsCollection = await getCollection('clients');
    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');
    const usersCollection = await getCollection('users');
    const reservationsCollection = await getCollection('reservations');
    const workshopsCollection = await getCollection('workshops');
    const sessionsCollection = await getCollection('workshop_sessions');

    // Get client
    const client = await clientsCollection.findOne({ _id: id });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    // Find user by email if exists
    const user = await usersCollection.findOne({ email: client.email });

    // Get orders
    const ordersQuery = {
      $or: [
        { guest_email: client.email },
        ...(user ? [{ user_id: user._id }] : [])
      ]
    };
    const orders = await ordersCollection.find(ordersQuery)
      .sort({ created_at: -1 })
      .limit(20)
      .toArray();

    const ordersWithCounts = await Promise.all(orders.map(async (o) => {
      const itemCount = await orderItemsCollection.countDocuments({ order_id: o._id });
      return {
        id: o._id,
        total: o.total,
        status: o.status,
        payment_status: o.payment_status,
        created_at: o.created_at,
        item_count: itemCount
      };
    }));

    // Get workshop bookings
    const reservationsQuery = {
      $or: [
        { guest_email: client.email },
        ...(user ? [{ user_id: user._id }] : [])
      ]
    };
    const reservations = await reservationsCollection.find(reservationsQuery)
      .sort({ created_at: -1 })
      .limit(20)
      .toArray();

    const workshops = await Promise.all(reservations.map(async (r) => {
      const workshop = await workshopsCollection.findOne({ _id: r.workshop_id });
      const session = await sessionsCollection.findOne({ _id: r.session_id });
      return {
        id: r._id,
        quantity: r.quantity,
        status: r.status,
        created_at: r.created_at,
        workshop_title: workshop?.title || null,
        session_date: session?.session_date || null,
        session_time: session?.session_time || null
      };
    }));

    res.json({
      success: true,
      data: {
        id: client._id,
        ...client,
        total_spent: parseFloat(client.total_spent || 0),
        orders: ordersWithCounts,
        workshops: workshops
      }
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du client',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/clients/:id/orders - Get client orders
router.get('/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;

    const clientsCollection = await getCollection('clients');
    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');
    const usersCollection = await getCollection('users');

    const client = await clientsCollection.findOne({ _id: id });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const user = await usersCollection.findOne({ email: client.email });
    const ordersQuery = {
      $or: [
        { guest_email: client.email },
        ...(user ? [{ user_id: user._id }] : [])
      ]
    };

    const orders = await ordersCollection.find(ordersQuery)
      .sort({ created_at: -1 })
      .toArray();

    const ordersWithCounts = await Promise.all(orders.map(async (o) => {
      const itemCount = await orderItemsCollection.countDocuments({ order_id: o._id });
      return {
        id: o._id,
        ...o,
        item_count: itemCount
      };
    }));

    res.json({
      success: true,
      data: ordersWithCounts
    });
  } catch (error) {
    console.error('Error fetching client orders:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/clients/:id/workshops - Get client workshops
router.get('/:id/workshops', async (req, res) => {
  try {
    const { id } = req.params;

    const clientsCollection = await getCollection('clients');
    const reservationsCollection = await getCollection('reservations');
    const workshopsCollection = await getCollection('workshops');
    const sessionsCollection = await getCollection('workshop_sessions');
    const usersCollection = await getCollection('users');

    const client = await clientsCollection.findOne({ _id: id });
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const user = await usersCollection.findOne({ email: client.email });
    const reservationsQuery = {
      $or: [
        { guest_email: client.email },
        ...(user ? [{ user_id: user._id }] : [])
      ]
    };

    const reservations = await reservationsCollection.find(reservationsQuery)
      .sort({ created_at: -1 })
      .toArray();

    const workshops = await Promise.all(reservations.map(async (r) => {
      const workshop = await workshopsCollection.findOne({ _id: r.workshop_id });
      const session = await sessionsCollection.findOne({ _id: r.session_id });
      return {
        id: r._id,
        ...r,
        workshop_title: workshop?.title || null,
        level: workshop?.level || null,
        session_date: session?.session_date || null,
        session_time: session?.session_time || null
      };
    }));

    res.json({
      success: true,
      data: workshops
    });
  } catch (error) {
    console.error('Error fetching client workshops:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des ateliers',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export { syncClient };
export default router;

