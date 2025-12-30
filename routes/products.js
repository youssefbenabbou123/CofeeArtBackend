import express from 'express';
import { getCollection } from '../db-mongodb.js';

const router = express.Router();

// GET all product categories (public endpoint)
router.get('/categories', async (req, res) => {
  try {
    const categoriesCollection = await getCollection('product_categories');
    
    const categories = await categoriesCollection.find({})
      .sort({ name: 1 })
      .toArray();

    res.json({
      success: true,
      data: categories.map(cat => ({ 
        id: cat._id, 
        name: cat.name, 
        type: cat.type || null,
        created_at: cat.created_at 
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET all products
router.get('/', async (req, res) => {
  try {
    const collection = await getCollection('products');
    
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
    
    // Transform products
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
        id: product._id,
        title: product.title,
        description: product.description,
        price: product.price || 0,
        image: images[0] || product.image || null,
        images: images,
        features: features,
        category: product.category,
        status: product.status,
        archived: product.archived,
        created_at: product.created_at
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET product by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const collection = await getCollection('products');
    
    const productData = await collection.findOne({ _id: id });
    
    if (!productData) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Get images array
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
    
    const product = {
      id: productData._id,
      title: productData.title,
      description: productData.description,
      price: productData.price || 0,
      image: images[0] || productData.image || null,
      images: images,
      features: features,
      created_at: productData.created_at
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

