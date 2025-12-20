import express from 'express';
import pool from '../../db.js';
import { verifyToken, requireAdmin } from '../../middleware/auth.js';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// Helper function to sync client from order/workshop
async function syncClient(data) {
  const { name, email, phone, address, city, postal_code, country } = data;
  
  if (!email) return null;

  // Check if client exists
  const existing = await pool.query(
    'SELECT * FROM clients WHERE email = $1',
    [email.toLowerCase()]
  );

  if (existing.rows.length > 0) {
    // Update client stats
    const client = existing.rows[0];
    await pool.query(
      `UPDATE clients 
       SET total_orders = total_orders + 1,
           last_order_date = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [client.id]
    );
    return client.id;
  } else {
    // Create new client
    const result = await pool.query(
      `INSERT INTO clients (name, email, phone, address, city, postal_code, country)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [name, email.toLowerCase(), phone || null, address || null, city || null, postal_code || null, country || 'France']
    );
    return result.rows[0].id;
  }
}

// GET /api/admin/clients - List clients with search
router.get('/', async (req, res) => {
  try {
    const { search, sort = 'last_order_date', order = 'DESC' } = req.query;

    let query = 'SELECT * FROM clients WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (search) {
      query += ` AND (
        name ILIKE $${paramCount} OR 
        email ILIKE $${paramCount} OR
        phone ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    const validSorts = ['name', 'email', 'last_order_date', 'total_orders', 'total_spent', 'created_at'];
    const sortField = validSorts.includes(sort) ? sort : 'last_order_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${sortField} ${sortOrder} NULLS LAST`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(client => ({
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

    // Get client
    const clientResult = await pool.query(
      'SELECT * FROM clients WHERE id = $1',
      [id]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const client = clientResult.rows[0];

    // Get orders
    const ordersResult = await pool.query(
      `SELECT 
        o.id,
        o.total,
        o.status,
        o.payment_status,
        o.created_at,
        COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.guest_email = $1 OR o.user_id IN (SELECT id FROM users WHERE email = $1)
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 20`,
      [client.email]
    );

    // Get workshop bookings
    const workshopsResult = await pool.query(
      `SELECT 
        r.id,
        r.quantity,
        r.status,
        r.created_at,
        w.title as workshop_title,
        ws.session_date,
        ws.session_time
       FROM reservations r
       LEFT JOIN workshops w ON r.workshop_id = w.id
       LEFT JOIN workshop_sessions ws ON r.session_id = ws.id
       WHERE r.guest_email = $1 OR r.user_id IN (SELECT id FROM users WHERE email = $1)
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [client.email]
    );

    res.json({
      success: true,
      data: {
        ...client,
        total_spent: parseFloat(client.total_spent || 0),
        orders: ordersResult.rows,
        workshops: workshopsResult.rows
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

    const clientResult = await pool.query('SELECT email FROM clients WHERE id = $1', [id]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const email = clientResult.rows[0].email;

    const result = await pool.query(
      `SELECT 
        o.*,
        COUNT(oi.id) as item_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.guest_email = $1 OR o.user_id IN (SELECT id FROM users WHERE email = $1)
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [email]
    );

    res.json({
      success: true,
      data: result.rows
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

    const clientResult = await pool.query('SELECT email FROM clients WHERE id = $1', [id]);
    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client non trouvé'
      });
    }

    const email = clientResult.rows[0].email;

    const result = await pool.query(
      `SELECT 
        r.*,
        w.title as workshop_title,
        w.level,
        ws.session_date,
        ws.session_time
       FROM reservations r
       LEFT JOIN workshops w ON r.workshop_id = w.id
       LEFT JOIN workshop_sessions ws ON r.session_id = ws.id
       WHERE r.guest_email = $1 OR r.user_id IN (SELECT id FROM users WHERE email = $1)
       ORDER BY r.created_at DESC`,
      [email]
    );

    res.json({
      success: true,
      data: result.rows
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

