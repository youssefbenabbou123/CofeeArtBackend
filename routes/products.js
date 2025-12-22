import express from 'express';
import pool from '../db.js';

const router = express.Router();

// GET all products
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, price, image, images, features, category, status, archived, created_at 
       FROM products 
       WHERE (status = 'active' OR status IS NULL) 
       AND (archived = false OR archived IS NULL)
       ORDER BY created_at DESC`
    );
    
    // Convert price from string to number and handle images array
    const products = result.rows.map(product => {
      // Get images array, fallback to single image, then to empty array
      let images = [];
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        images = product.images;
      } else if (product.image) {
        images = [product.image];
      }
      
      // Get features array
      let features = [];
      if (product.features && Array.isArray(product.features) && product.features.length > 0) {
        features = product.features;
      }
      
      return {
        ...product,
        price: parseFloat(product.price),
        images: images,
        image: images[0] || product.image || null, // Keep image for backward compatibility
        features: features
      };
    });
    
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
      'SELECT id, title, description, price, image, images, features, created_at FROM products WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const productData = result.rows[0];
    
    // Get images array, fallback to single image, then to empty array
    let images = [];
    if (productData.images && Array.isArray(productData.images) && productData.images.length > 0) {
      images = productData.images;
    } else if (productData.image) {
      images = [productData.image];
    }
    
    // Get features array
    let features = [];
    if (productData.features && Array.isArray(productData.features) && productData.features.length > 0) {
      features = productData.features;
    }
    
    // Convert price from string to number (PostgreSQL DECIMAL returns as string)
    const product = {
      ...productData,
      price: parseFloat(productData.price),
      images: images,
      image: images[0] || productData.image || null, // Keep image for backward compatibility
      features: features
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

