// EXAMPLE: Products route converted to MongoDB
// This is an example showing how to convert from PostgreSQL to MongoDB
// Replace the existing products.js with MongoDB queries

import express from 'express';
import { getCollection } from '../db-mongodb.js';

const router = express.Router();

// GET all products
router.get('/', async (req, res) => {
  try {
    const collection = await getCollection('products');
    
    // MongoDB query equivalent to PostgreSQL WHERE clause
    const products = await collection.find({
      $and: [
        {
          $or: [
            { status: 'active' },
            { status: null }
          ]
        },
        {
          $or: [
            { archived: false },
            { archived: null }
          ]
        }
      ]
    })
    .sort({ created_at: -1 })
    .toArray();
    
    // Transform products (images, features, etc.)
    const transformedProducts = products.map(product => {
      // Get images array
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
        id: product._id, // MongoDB uses _id, but we expose as id for API compatibility
        ...product,
        price: product.price || 0,
        images: images,
        image: images[0] || product.image || null,
        features: features
      };
    });
    
    res.json({
      success: true,
      data: transformedProducts
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

// GET single product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await getCollection('products');
    
    const product = await collection.findOne({ _id: id });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Transform product
    let images = [];
    if (product.images && Array.isArray(product.images) && product.images.length > 0) {
      images = product.images;
    } else if (product.image) {
      images = [product.image];
    }
    
    let features = [];
    if (product.features && Array.isArray(product.features) && product.features.length > 0) {
      features = product.features;
    }
    
    res.json({
      success: true,
      data: {
        id: product._id,
        ...product,
        images: images,
        image: images[0] || product.image || null,
        features: features
      }
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching product',
      error: error.message
    });
  }
});

// POST create product (admin only - add auth middleware)
router.post('/', async (req, res) => {
  try {
    const collection = await getCollection('products');
    const productData = {
      ...req.body,
      created_at: new Date(),
      status: req.body.status || 'active',
      archived: req.body.archived || false
    };
    
    // Convert images to array if single image provided
    if (productData.image && !productData.images) {
      productData.images = [productData.image];
    }
    
    const result = await collection.insertOne(productData);
    
    res.status(201).json({
      success: true,
      data: {
        id: result.insertedId,
        ...productData
      }
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating product',
      error: error.message
    });
  }
});

// PUT update product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await getCollection('products');
    
    const updateData = {
      ...req.body,
      updated_at: new Date()
    };
    
    // Handle images
    if (updateData.image && !updateData.images) {
      updateData.images = [updateData.image];
    }
    
    const result = await collection.updateOne(
      { _id: id },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    const updatedProduct = await collection.findOne({ _id: id });
    
    res.json({
      success: true,
      data: {
        id: updatedProduct._id,
        ...updatedProduct
      }
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating product',
      error: error.message
    });
  }
});

// DELETE product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await getCollection('products');
    
    const result = await collection.deleteOne({ _id: id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting product',
      error: error.message
    });
  }
});

export default router;

