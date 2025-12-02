import express from 'express';
import pool from '../db.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Debug middleware to log all admin route requests
router.use((req, res, next) => {
  console.log(`[Admin Route] ${req.method} ${req.path}`);
  next();
});

// Test route (no auth required for debugging)
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Admin routes are working!' });
});

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireAdmin);

// ========== USERS ==========

// GET /api/admin/users - List all users
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs',
      error: error.message
    });
  }
});

// PUT /api/admin/users/:id - Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Le rôle est requis'
      });
    }

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role, created_at',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Utilisateur mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'utilisateur',
      error: error.message
    });
  }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting yourself
    if (id === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Vous ne pouvez pas supprimer votre propre compte'
      });
    }

    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Utilisateur supprimé'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'utilisateur',
      error: error.message
    });
  }
});

// ========== PRODUCTS ==========

// GET /api/admin/products - List all products with filters
router.get('/products', async (req, res) => {
  try {
    const { category, status } = req.query;
    let query = 'SELECT id, title, description, price, image, category, status, created_at FROM products';
    const params = [];
    const conditions = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    const products = result.rows.map(product => ({
      ...product,
      price: parseFloat(product.price)
    }));

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des produits',
      error: error.message
    });
  }
});

// POST /api/admin/products - Create product
router.post('/products', async (req, res) => {
  try {
    const { title, description, price, image, category, status } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        message: 'Le titre et le prix sont requis'
      });
    }

    const result = await pool.query(
      'INSERT INTO products (title, description, price, image, category, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, description, price, image, category, status, created_at',
      [title, description || null, price, image || null, category || null, status || 'active']
    );

    const product = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price)
    };

    res.status(201).json({
      success: true,
      message: 'Produit créé avec succès',
      data: product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du produit',
      error: error.message
    });
  }
});

// PUT /api/admin/products/:id - Update product
router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, image, category, status } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (image !== undefined) {
      updates.push(`image = $${paramCount++}`);
      values.push(image);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, title, description, price, image, category, status, created_at`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    const product = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price)
    };

    res.json({
      success: true,
      message: 'Produit mis à jour',
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du produit',
      error: error.message
    });
  }
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Produit supprimé'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du produit',
      error: error.message
    });
  }
});

// ========== MESSAGES ==========

// GET /api/admin/messages - List contact form messages
router.get('/messages', async (req, res) => {
  try {
    const { read, subject } = req.query;
    let query = 'SELECT id, name, email, subject, message, read, created_at FROM contact_messages';
    const params = [];
    const conditions = [];

    if (read !== undefined) {
      params.push(read === 'true');
      conditions.push(`read = $${params.length}`);
    }

    if (subject) {
      params.push(`%${subject}%`);
      conditions.push(`subject ILIKE $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages',
      error: error.message
    });
  }
});

// PUT /api/admin/messages/:id - Update message (mark as read/unread)
router.put('/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { read } = req.body;

    if (read === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Le statut read est requis'
      });
    }

    const result = await pool.query(
      'UPDATE contact_messages SET read = $1 WHERE id = $2 RETURNING id, name, email, subject, message, read, created_at',
      [read, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Message mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du message',
      error: error.message
    });
  }
});

// DELETE /api/admin/messages/:id - Delete message
router.delete('/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM contact_messages WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Message supprimé'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du message',
      error: error.message
    });
  }
});

// ========== STATISTICS ==========

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Get users count
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const usersCount = parseInt(usersResult.rows[0].count);

    // Get products count
    const productsResult = await pool.query('SELECT COUNT(*) as count FROM products');
    const productsCount = parseInt(productsResult.rows[0].count);

    // Get messages count
    const messagesResult = await pool.query('SELECT COUNT(*) as count FROM contact_messages');
    const messagesCount = parseInt(messagesResult.rows[0].count);

    // Get unread messages count
    const unreadResult = await pool.query('SELECT COUNT(*) as count FROM contact_messages WHERE read = false');
    const unreadCount = parseInt(unreadResult.rows[0].count);

    // Get sales data (static for now)
    const salesData = [
      { month: 'Jan', sales: 1200 },
      { month: 'Fév', sales: 1900 },
      { month: 'Mar', sales: 3000 },
      { month: 'Avr', sales: 2800 },
      { month: 'Mai', sales: 3500 },
      { month: 'Jun', sales: 4200 },
    ];

    // Get category distribution (static for now)
    const categoryData = [
      { name: 'Tasses', value: 35 },
      { name: 'Assiettes', value: 25 },
      { name: 'Bols', value: 20 },
      { name: 'Vases', value: 15 },
      { name: 'Autres', value: 5 },
    ];

    // Get user registrations (static for now)
    const registrationsData = [
      { month: 'Jan', users: 12 },
      { month: 'Fév', users: 19 },
      { month: 'Mar', users: 25 },
      { month: 'Avr', users: 30 },
      { month: 'Mai', users: 35 },
      { month: 'Jun', users: 42 },
    ];

    res.json({
      success: true,
      data: {
        users: usersCount,
        products: productsCount,
        messages: messagesCount,
        unreadMessages: unreadCount,
        salesData,
        categoryData,
        registrationsData
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: error.message
    });
  }
});

// ========== SETTINGS ==========

// GET /api/admin/settings - Get site settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT key, value FROM site_settings ORDER BY key'
    );

    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des paramètres',
      error: error.message
    });
  }
});

// PUT /api/admin/settings - Update site settings
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;

    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        'INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()',
        [key, value]
      );
    }

    // Get updated settings
    const result = await pool.query(
      'SELECT key, value FROM site_settings ORDER BY key'
    );

    const updatedSettings = {};
    result.rows.forEach(row => {
      updatedSettings[row.key] = row.value;
    });

    res.json({
      success: true,
      message: 'Paramètres mis à jour',
      data: updatedSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour des paramètres',
      error: error.message
    });
  }
});

export default router;

