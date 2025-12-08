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
    const { category, status, collection, archived, low_stock } = req.query;
    let query = `SELECT 
      id, title, description, price, price_ht, tva_rate, image, category, collection, 
      status, stock, stock_alert_threshold, archived, created_at 
      FROM products WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND category = $${paramCount++}`;
      params.push(category);
    }

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (collection) {
      query += ` AND collection = $${paramCount++}`;
      params.push(collection);
    }

    if (archived !== undefined) {
      query += ` AND archived = $${paramCount++}`;
      params.push(archived === 'true');
    } else {
      // By default, exclude archived unless specifically requested
      query += ` AND archived = false`;
    }

    if (low_stock === 'true') {
      query += ` AND stock <= stock_alert_threshold`;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    const products = result.rows.map(product => ({
      ...product,
      price: parseFloat(product.price || 0),
      price_ht: product.price_ht ? parseFloat(product.price_ht) : null,
      tva_rate: product.tva_rate ? parseFloat(product.tva_rate) : 20,
      stock: parseInt(product.stock || 0),
      stock_alert_threshold: parseInt(product.stock_alert_threshold || 10)
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
    const { 
      title, description, price, price_ht, tva_rate, image, category, collection, 
      status, stock, stock_alert_threshold, archived 
    } = req.body;

    if (!title || (!price && !price_ht)) {
      return res.status(400).json({
        success: false,
        message: 'Le titre et le prix sont requis'
      });
    }

    // Calculate price_ht if not provided, or calculate price TTC if price_ht provided
    let finalPrice = price;
    let finalPriceHt = price_ht;
    const finalTvaRate = tva_rate || 20;

    if (price_ht && !price) {
      // Calculate TTC from HT
      finalPrice = price_ht * (1 + finalTvaRate / 100);
    } else if (price && !price_ht) {
      // Calculate HT from TTC
      finalPriceHt = price / (1 + finalTvaRate / 100);
    }

    const result = await pool.query(
      `INSERT INTO products (
        title, description, price, price_ht, tva_rate, image, category, collection,
        status, stock, stock_alert_threshold, archived
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *`,
      [
        title, 
        description || null, 
        finalPrice, 
        finalPriceHt || null, 
        finalTvaRate,
        image || null, 
        category || null, 
        collection || null,
        status || 'active',
        stock || 0,
        stock_alert_threshold || 10,
        archived || false
      ]
    );

    const product = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price),
      price_ht: result.rows[0].price_ht ? parseFloat(result.rows[0].price_ht) : null,
      tva_rate: parseFloat(result.rows[0].tva_rate || 20),
      stock: parseInt(result.rows[0].stock || 0)
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
    const { 
      title, description, price, price_ht, tva_rate, image, category, collection,
      status, stock, stock_alert_threshold, archived 
    } = req.body;

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
    if (price_ht !== undefined) {
      updates.push(`price_ht = $${paramCount++}`);
      values.push(price_ht);
    }
    if (tva_rate !== undefined) {
      updates.push(`tva_rate = $${paramCount++}`);
      values.push(tva_rate);
    }
    if (image !== undefined) {
      updates.push(`image = $${paramCount++}`);
      values.push(image);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (collection !== undefined) {
      updates.push(`collection = $${paramCount++}`);
      values.push(collection);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (stock !== undefined) {
      updates.push(`stock = $${paramCount++}`);
      values.push(stock);
    }
    if (stock_alert_threshold !== undefined) {
      updates.push(`stock_alert_threshold = $${paramCount++}`);
      values.push(stock_alert_threshold);
    }
    if (archived !== undefined) {
      updates.push(`archived = $${paramCount++}`);
      values.push(archived);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(id);
    const query = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    const product = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price),
      price_ht: result.rows[0].price_ht ? parseFloat(result.rows[0].price_ht) : null,
      tva_rate: parseFloat(result.rows[0].tva_rate || 20),
      stock: parseInt(result.rows[0].stock || 0)
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

// PUT /api/admin/products/:id/archive - Archive/unarchive product
router.put('/products/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const { archived } = req.body;

    const result = await pool.query(
      'UPDATE products SET archived = $1 WHERE id = $2 RETURNING id, archived',
      [archived !== false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    res.json({
      success: true,
      message: archived ? 'Produit archivé' : 'Produit désarchivé',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error archiving product:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage',
      error: error.message
    });
  }
});

// GET /api/admin/products/:id/variants - Get product variants
router.get('/products/:id/variants', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM product_variants WHERE product_id = $1 ORDER BY created_at',
      [id]
    );

    res.json({
      success: true,
      data: result.rows.map(variant => ({
        ...variant,
        stock: parseInt(variant.stock || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des variantes',
      error: error.message
    });
  }
});

// POST /api/admin/products/:id/variants - Create variant
router.post('/products/:id/variants', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, size, flavor, stock } = req.body;

    const result = await pool.query(
      `INSERT INTO product_variants (product_id, name, color, size, flavor, stock)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, name || null, color || null, size || null, flavor || null, stock || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Variante créée',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la variante',
      error: error.message
    });
  }
});

// PUT /api/admin/products/variants/:variantId - Update variant
router.put('/products/variants/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;
    const { name, color, size, flavor, stock } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (color !== undefined) {
      updates.push(`color = $${paramCount++}`);
      values.push(color);
    }
    if (size !== undefined) {
      updates.push(`size = $${paramCount++}`);
      values.push(size);
    }
    if (flavor !== undefined) {
      updates.push(`flavor = $${paramCount++}`);
      values.push(flavor);
    }
    if (stock !== undefined) {
      updates.push(`stock = $${paramCount++}`);
      values.push(stock);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(variantId);
    const query = `UPDATE product_variants SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Variante non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Variante mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la variante',
      error: error.message
    });
  }
});

// DELETE /api/admin/products/variants/:variantId - Delete variant
router.delete('/products/variants/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;

    const result = await pool.query(
      'DELETE FROM product_variants WHERE id = $1 RETURNING id',
      [variantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Variante non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Variante supprimée'
    });
  } catch (error) {
    console.error('Error deleting variant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la variante',
      error: error.message
    });
  }
});

// GET /api/admin/products/collections - Get all collections
router.get('/products/collections', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM product_collections ORDER BY name'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des collections',
      error: error.message
    });
  }
});

// POST /api/admin/products/collections - Create collection
router.post('/products/collections', async (req, res) => {
  try {
    const { name, description, image } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Le nom de la collection est requis'
      });
    }

    const result = await pool.query(
      `INSERT INTO product_collections (name, description, image)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || null, image || null]
    );

    res.status(201).json({
      success: true,
      message: 'Collection créée',
      data: result.rows[0]
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Une collection avec ce nom existe déjà'
      });
    }
    console.error('Error creating collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la collection',
      error: error.message
    });
  }
});

// PUT /api/admin/products/collections/:id - Update collection
router.put('/products/collections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (image !== undefined) {
      updates.push(`image = $${paramCount++}`);
      values.push(image);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(id);
    const query = `UPDATE product_collections SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Collection mise à jour',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la collection',
      error: error.message
    });
  }
});

// DELETE /api/admin/products/collections/:id - Delete collection
router.delete('/products/collections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM product_collections WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Collection supprimée'
    });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la collection',
      error: error.message
    });
  }
});

// POST /api/admin/products/:id/stock - Update stock
router.post('/products/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, movement_type, notes } = req.body;
    const userId = req.user?.userId || null;

    if (!movement_type || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Type de mouvement et quantité sont requis'
      });
    }

    const validTypes = ['sale', 'return', 'restock', 'adjustment', 'damaged'];
    if (!validTypes.includes(movement_type)) {
      return res.status(400).json({
        success: false,
        message: 'Type de mouvement invalide'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get current stock
      const productResult = await client.query('SELECT stock FROM products WHERE id = $1', [id]);
      if (productResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      const currentStock = parseInt(productResult.rows[0].stock || 0);
      let newStock = currentStock;

      // Calculate new stock based on movement type
      if (movement_type === 'sale' || movement_type === 'damaged') {
        newStock = currentStock - Math.abs(quantity);
      } else if (movement_type === 'return' || movement_type === 'restock') {
        newStock = currentStock + Math.abs(quantity);
      } else if (movement_type === 'adjustment') {
        newStock = quantity; // Direct adjustment
      }

      // Update product stock
      await client.query(
        'UPDATE products SET stock = $1 WHERE id = $2',
        [newStock, id]
      );

      // Record stock movement
      await client.query(
        `INSERT INTO stock_movements (product_id, movement_type, quantity, previous_stock, new_stock, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, movement_type, quantity, currentStock, newStock, notes || null, userId]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        message: 'Stock mis à jour',
        data: {
          previous_stock: currentStock,
          new_stock: newStock,
          movement_type
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du stock',
      error: error.message
    });
  }
});

// GET /api/admin/products/:id/stock-history - Get stock history
router.get('/products/:id/stock-history', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        sm.*,
        u.name as created_by_name
       FROM stock_movements sm
       LEFT JOIN users u ON sm.created_by = u.id
       WHERE sm.product_id = $1
       ORDER BY sm.created_at DESC
       LIMIT 50`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows.map(movement => ({
        ...movement,
        quantity: parseInt(movement.quantity),
        previous_stock: parseInt(movement.previous_stock || 0),
        new_stock: parseInt(movement.new_stock || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      error: error.message
    });
  }
});

// GET /api/admin/products/export - Export products to CSV
router.get('/products/export', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        title,
        description,
        price,
        price_ht,
        tva_rate,
        category,
        collection,
        stock,
        stock_alert_threshold,
        status,
        archived,
        created_at
       FROM products
       WHERE archived = false
       ORDER BY created_at DESC`
    );

    // Create CSV manually with proper formatting
    const headers = ['ID', 'Titre', 'Description', 'Prix TTC', 'Prix HT', 'TVA %', 'Catégorie', 'Collection', 'Stock', 'Seuil alerte', 'Statut', 'Date création'];
    const csvRows = [headers.join(',')];

    result.rows.forEach(row => {
      const values = [
        row.id,
        `"${(row.title || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
        `"${(row.description || '').replace(/"/g, '""')}"`,
        parseFloat(row.price || 0).toFixed(2),
        row.price_ht ? parseFloat(row.price_ht).toFixed(2) : '',
        parseFloat(row.tva_rate || 20).toFixed(2),
        row.category || '',
        row.collection || '',
        row.stock || 0,
        row.stock_alert_threshold || 10,
        row.status || '',
        new Date(row.created_at).toLocaleDateString('fr-FR')
      ];
      csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    
    // Set proper headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="produits-${new Date().toISOString().split('T')[0]}.csv"`);
    
    // Add BOM for Excel compatibility (UTF-8)
    res.write('\ufeff');
    res.end(csvContent);
  } catch (error) {
    console.error('Error exporting products:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export',
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
    const { start_date, end_date } = req.query;
    
    // Date range filter
    let dateFilter = '';
    const dateParams = [];
    if (start_date && end_date) {
      dateFilter = ' AND o.created_at BETWEEN $1 AND $2';
      dateParams.push(start_date, end_date);
    } else if (start_date) {
      dateFilter = ' AND o.created_at >= $1';
      dateParams.push(start_date);
    } else if (end_date) {
      dateFilter = ' AND o.created_at <= $1';
      dateParams.push(end_date);
    }

    // Get users count
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const usersCount = parseInt(usersResult.rows[0].count);

    // Get products count (not archived)
    const productsResult = await pool.query('SELECT COUNT(*) as count FROM products WHERE archived = false');
    const productsCount = parseInt(productsResult.rows[0].count);

    // Get messages count
    const messagesResult = await pool.query('SELECT COUNT(*) as count FROM contact_messages');
    const messagesCount = parseInt(messagesResult.rows[0].count);

    // Get unread messages count
    const unreadResult = await pool.query('SELECT COUNT(*) as count FROM contact_messages WHERE read = false');
    const unreadCount = parseInt(unreadResult.rows[0].count);

    // Get real revenue (from orders)
    const revenueQuery = `SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled' AND status != 'refunded'${dateFilter}`;
    const revenueResult = await pool.query(revenueQuery, dateParams);
    const revenue = parseFloat(revenueResult.rows[0].revenue || 0);

    // Get orders count
    const ordersQuery = `SELECT COUNT(*) as count FROM orders WHERE 1=1${dateFilter}`;
    const ordersResult = await pool.query(ordersQuery, dateParams);
    const ordersCount = parseInt(ordersResult.rows[0].count);

    // Get sales data by month (last 6 months)
    const salesDataQuery = `
      SELECT 
        TO_CHAR(created_at, 'Mon') as month,
        EXTRACT(MONTH FROM created_at) as month_num,
        COALESCE(SUM(total), 0) as sales
      FROM orders 
      WHERE status != 'cancelled' AND status != 'refunded'
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY EXTRACT(MONTH FROM created_at), TO_CHAR(created_at, 'Mon')
      ORDER BY month_num
    `;
    const salesDataResult = await pool.query(salesDataQuery);
    const salesData = salesDataResult.rows.map(row => ({
      month: row.month,
      sales: parseFloat(row.sales || 0)
    }));

    // Get category distribution (real data)
    const categoryQuery = `
      SELECT 
        p.category,
        COUNT(oi.id) as count,
        COALESCE(SUM(oi.quantity), 0) as total_quantity
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled' AND o.status != 'refunded'
        ${dateFilter ? `AND o.created_at BETWEEN $${dateParams.length + 1} AND $${dateParams.length + 2}` : ''}
      GROUP BY p.category
      ORDER BY total_quantity DESC
      LIMIT 5
    `;
    const categoryResult = await pool.query(categoryQuery, dateFilter ? dateParams : []);
    const categoryData = categoryResult.rows.map(row => ({
      name: row.category || 'Sans catégorie',
      value: parseInt(row.total_quantity || 0)
    }));

    // Get top products
    const topProductsQuery = `
      SELECT 
        p.id,
        p.title,
        COUNT(oi.id) as order_count,
        COALESCE(SUM(oi.quantity), 0) as total_sold
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled' AND o.status != 'refunded'
        ${dateFilter ? `AND o.created_at BETWEEN $${dateParams.length + 1} AND $${dateParams.length + 2}` : ''}
      GROUP BY p.id, p.title
      ORDER BY total_sold DESC
      LIMIT 5
    `;
    const topProductsResult = await pool.query(topProductsQuery, dateFilter ? dateParams : []);
    const topProducts = topProductsResult.rows.map(row => ({
      id: row.id,
      title: row.title,
      sold: parseInt(row.total_sold || 0)
    }));

    // Get user registrations by month (last 6 months)
    const registrationsQuery = `
      SELECT 
        TO_CHAR(created_at, 'Mon') as month,
        EXTRACT(MONTH FROM created_at) as month_num,
        COUNT(*) as users
      FROM users
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY EXTRACT(MONTH FROM created_at), TO_CHAR(created_at, 'Mon')
      ORDER BY month_num
    `;
    const registrationsResult = await pool.query(registrationsQuery);
    const registrationsData = registrationsResult.rows.map(row => ({
      month: row.month,
      users: parseInt(row.users || 0)
    }));

    // Get workshop stats
    const workshopsResult = await pool.query('SELECT COUNT(*) as count FROM workshops WHERE status = $1', ['active']);
    const workshopsCount = parseInt(workshopsResult.rows[0].count);

    const bookingsResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM reservations 
      WHERE status = 'confirmed' AND cancelled_at IS NULL
    `);
    const bookingsCount = parseInt(bookingsResult.rows[0].count);

    // Get order status breakdown
    const statusBreakdownQuery = `
      SELECT status, COUNT(*) as count
      FROM orders
      ${dateFilter ? `WHERE created_at BETWEEN $1 AND $2` : ''}
      GROUP BY status
    `;
    const statusBreakdownResult = await pool.query(statusBreakdownQuery, dateFilter ? dateParams : []);
    const orderStatusData = statusBreakdownResult.rows.map(row => ({
      status: row.status,
      count: parseInt(row.count || 0)
    }));

    res.json({
      success: true,
      data: {
        users: usersCount,
        products: productsCount,
        messages: messagesCount,
        unreadMessages: unreadCount,
        revenue,
        orders: ordersCount,
        workshops: workshopsCount,
        bookings: bookingsCount,
        salesData,
        categoryData,
        topProducts,
        registrationsData,
        orderStatusData
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

// ========== BLOGS ==========

// GET /api/admin/blogs - List all blogs
router.get('/blogs', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, excerpt, content, image, author, category, slug, published, created_at, updated_at FROM blog_posts ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des blogs',
      error: error.message
    });
  }
});

// GET /api/admin/blogs/:id - Get single blog
router.get('/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM blog_posts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog non trouvé'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du blog',
      error: error.message
    });
  }
});

// POST /api/admin/blogs - Create blog
router.post('/blogs', async (req, res) => {
  try {
    const { title, content, excerpt, image, author, category, slug, published } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Le titre et le contenu sont requis'
      });
    }

    // Generate slug from title if not provided
    let finalSlug = slug || title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Ensure slug is unique
    const existingSlug = await pool.query(
      'SELECT id FROM blog_posts WHERE slug = $1',
      [finalSlug]
    );

    if (existingSlug.rows.length > 0) {
      finalSlug = `${finalSlug}-${Date.now()}`;
    }

    const result = await pool.query(
      `INSERT INTO blog_posts (title, content, excerpt, image, author, category, slug, published) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING id, title, excerpt, content, image, author, category, slug, published, created_at, updated_at`,
      [title, content, excerpt || null, image || null, author || null, category || null, finalSlug, published !== false]
    );

    res.status(201).json({
      success: true,
      message: 'Blog créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du blog',
      error: error.message
    });
  }
});

// PUT /api/admin/blogs/:id - Update blog
router.put('/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, image, author, category, slug, published } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(content);
    }
    if (excerpt !== undefined) {
      updates.push(`excerpt = $${paramCount++}`);
      values.push(excerpt);
    }
    if (image !== undefined) {
      updates.push(`image = $${paramCount++}`);
      values.push(image);
    }
    if (author !== undefined) {
      updates.push(`author = $${paramCount++}`);
      values.push(author);
    }
    if (category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(category);
    }
    if (slug !== undefined) {
      // Check if slug is unique (excluding current blog)
      const existingSlug = await pool.query(
        'SELECT id FROM blog_posts WHERE slug = $1 AND id != $2',
        [slug, id]
      );
      if (existingSlug.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ce slug est déjà utilisé'
        });
      }
      updates.push(`slug = $${paramCount++}`);
      values.push(slug);
    }
    if (published !== undefined) {
      updates.push(`published = $${paramCount++}`);
      values.push(published);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    // Add updated_at
    updates.push(`updated_at = now()`);
    values.push(id);

    const query = `UPDATE blog_posts SET ${updates.join(', ')} WHERE id = $${paramCount} 
                   RETURNING id, title, excerpt, content, image, author, category, slug, published, created_at, updated_at`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Blog mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du blog',
      error: error.message
    });
  }
});

// DELETE /api/admin/blogs/:id - Delete blog
router.delete('/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM blog_posts WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Blog supprimé'
    });
  } catch (error) {
    console.error('Error deleting blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du blog',
      error: error.message
    });
  }
});

export default router;

