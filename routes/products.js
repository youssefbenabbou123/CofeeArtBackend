import express from 'express';
import pool from '../db.js';

const router = express.Router();

// GET all products
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, price, image, created_at FROM products ORDER BY created_at DESC'
    );
    
    // Convert price from string to number (PostgreSQL DECIMAL returns as string)
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
      message: 'Error fetching products',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, title, description, price, image, created_at FROM products WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Convert price from string to number (PostgreSQL DECIMAL returns as string)
    const product = {
      ...result.rows[0],
      price: parseFloat(result.rows[0].price)
    };
    
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

