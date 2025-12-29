import express from 'express';
import { getCollection } from '../db-mongodb.js';
import { verifyToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Debug middleware to log all admin route requests
router.use((req, res, next) => {
  console.log(`[Admin Route] ${req.method} ${req.path}`);
  next();
});

// Test route (development only - removed in production for security)
if (process.env.NODE_ENV === 'development') {
  router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Admin routes are working!' });
  });
}

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireAdmin);

// ========== USERS ==========

// GET /api/admin/users - List all users
router.get('/users', async (req, res) => {
  try {
    const usersCollection = await getCollection('users');
    const users = await usersCollection.find({})
      .sort({ created_at: -1 })
      .toArray();

    const usersData = users.map(user => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at
    }));

    res.json({
      success: true,
      data: usersData
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const usersCollection = await getCollection('users');
    const result = await usersCollection.updateOne(
      { _id: id },
      { $set: { role: role } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const user = await usersCollection.findOne({ _id: id });
    res.json({
      success: true,
      message: 'Utilisateur mis à jour',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'utilisateur',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const usersCollection = await getCollection('users');
    const result = await usersCollection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// ========== PRODUCTS ==========

// GET /api/admin/products - List all products with filters
router.get('/products', async (req, res) => {
  try {
    const { category, status, collection, archived, low_stock } = req.query;
    const productsCollection = await getCollection('products');
    
    const query = {};
    if (category) query.category = category;
    if (status) query.status = status;
    if (collection) query.collection = collection;
    if (archived !== undefined) {
      query.archived = archived === 'true';
    } else {
      query.archived = false;
    }
    if (low_stock === 'true') {
      query.$expr = { $lte: ['$stock', '$stock_alert_threshold'] };
    }

    const products = await productsCollection.find(query)
      .sort({ created_at: -1 })
      .toArray();

    const transformedProducts = products.map(product => {
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
        id: product._id,
        title: product.title,
        description: product.description,
        price: parseFloat(product.price || 0),
        price_ht: product.price_ht ? parseFloat(product.price_ht) : null,
        tva_rate: product.tva_rate ? parseFloat(product.tva_rate) : 20,
        image: images[0] || product.image || null,
        images: images,
        features: features,
        category: product.category,
        collection: product.collection,
        status: product.status,
        stock: parseInt(product.stock || 0),
        stock_alert_threshold: parseInt(product.stock_alert_threshold || 10),
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
      message: 'Erreur lors de la récupération des produits',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    // Handle images array
    let imagesArray = [];
    if (req.body.images && Array.isArray(req.body.images) && req.body.images.length > 0) {
      imagesArray = req.body.images;
    } else if (image) {
      imagesArray = [image];
    }
    const firstImage = imagesArray.length > 0 ? imagesArray[0] : image || null;

    // Handle features array
    const featuresArray = req.body.features && Array.isArray(req.body.features) && req.body.features.length > 0
      ? req.body.features.filter((f) => f && f.trim() !== '') // Filter out empty features
      : [];

    const productsCollection = await getCollection('products');
    
    const productData = {
      title,
      description: description || null,
      price: finalPrice,
      price_ht: finalPriceHt || null,
      tva_rate: finalTvaRate,
      image: firstImage,
      images: imagesArray,
      features: featuresArray,
      category: category || null,
      collection: collection || null,
      status: status || 'active',
      stock: stock || 0,
      stock_alert_threshold: stock_alert_threshold || 10,
      archived: archived || false,
      created_at: new Date()
    };

    const result = await productsCollection.insertOne(productData);
    const product = {
      id: result.insertedId,
      ...productData,
      price: parseFloat(productData.price),
      price_ht: productData.price_ht ? parseFloat(productData.price_ht) : null,
      tva_rate: parseFloat(productData.tva_rate || 20),
      stock: parseInt(productData.stock || 0)
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PUT /api/admin/products/:id - Update product
router.put('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, description, price, price_ht, tva_rate, image, images, category, collection,
      status, stock, stock_alert_threshold, archived 
    } = req.body;

    const productsCollection = await getCollection('products');
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (price_ht !== undefined) updateData.price_ht = price_ht ? parseFloat(price_ht) : null;
    if (tva_rate !== undefined) updateData.tva_rate = parseFloat(tva_rate);
    
    // Handle images array
    if (images !== undefined || image !== undefined) {
      let imagesArray = [];
      if (images !== undefined && Array.isArray(images) && images.length > 0) {
        imagesArray = images;
      } else if (image !== undefined && image) {
        imagesArray = [image];
      } else if (images !== undefined) {
        imagesArray = [];
      }
      updateData.images = imagesArray;
      updateData.image = imagesArray.length > 0 ? imagesArray[0] : (image || null);
    }
    
    // Handle features array
    if (req.body.features !== undefined) {
      updateData.features = Array.isArray(req.body.features) && req.body.features.length > 0
        ? req.body.features.filter((f) => f && f.trim() !== '')
        : [];
    }
    if (category !== undefined) updateData.category = category;
    if (collection !== undefined) updateData.collection = collection;
    if (status !== undefined) updateData.status = status;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (stock_alert_threshold !== undefined) updateData.stock_alert_threshold = parseInt(stock_alert_threshold);
    if (archived !== undefined) updateData.archived = archived;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    const result = await productsCollection.updateOne(
      { _id: id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    const productData = await productsCollection.findOne({ _id: id });
    
    // Get images array
    let productImages = [];
    if (productData.images && Array.isArray(productData.images) && productData.images.length > 0) {
      productImages = productData.images;
    } else if (productData.image) {
      productImages = [productData.image];
    }
    
    // Get features array
    let productFeatures = [];
    if (productData.features && Array.isArray(productData.features) && productData.features.length > 0) {
      productFeatures = productData.features;
    }

    const product = {
      id: productData._id,
      ...productData,
      price: parseFloat(productData.price),
      price_ht: productData.price_ht ? parseFloat(productData.price_ht) : null,
      tva_rate: parseFloat(productData.tva_rate || 20),
      stock: parseInt(productData.stock || 0),
      images: productImages,
      image: productImages[0] || productData.image || null,
      features: productFeatures
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/products/:id - Delete product
router.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const productsCollection = await getCollection('products');
    const result = await productsCollection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// ========== PRODUCT CATEGORIES ==========

// GET /api/admin/categories - Get all product categories
router.get('/categories', async (req, res) => {
  try {
    const categoriesCollection = await getCollection('product_categories');
    
    const categories = await categoriesCollection.find({})
      .sort({ name: 1 })
      .toArray();

    // If no categories in DB, return default ones
    if (categories.length === 0) {
      const defaultCategories = [
        { id: '1', name: 'Tasses', created_at: new Date().toISOString() },
        { id: '2', name: 'Assiettes', created_at: new Date().toISOString() },
        { id: '3', name: 'Pièces uniques', created_at: new Date().toISOString() },
        { id: '4', name: 'Collections spéciales', created_at: new Date().toISOString() },
        { id: '5', name: 'Tote bags', created_at: new Date().toISOString() },
        { id: '6', name: 'Affiches / prints', created_at: new Date().toISOString() },
      ];
      return res.json({
        success: true,
        data: defaultCategories
      });
    }

    res.json({
      success: true,
      data: categories.map(cat => ({ id: cat._id, name: cat.name, created_at: cat.created_at }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    // If error is about table not existing, return default categories
    if (error.message.includes('does not exist') || error.code === '42P01') {
      const defaultCategories = [
        { id: '1', name: 'Tasses', created_at: new Date().toISOString() },
        { id: '2', name: 'Assiettes', created_at: new Date().toISOString() },
        { id: '3', name: 'Pièces uniques', created_at: new Date().toISOString() },
        { id: '4', name: 'Collections spéciales', created_at: new Date().toISOString() },
        { id: '5', name: 'Tote bags', created_at: new Date().toISOString() },
        { id: '6', name: 'Affiches / prints', created_at: new Date().toISOString() },
      ];
      return res.json({
        success: true,
        data: defaultCategories
      });
    }
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des catégories',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// POST /api/admin/categories - Create new category
router.post('/categories', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Le nom de la catégorie est requis'
      });
    }

    const categoriesCollection = await getCollection('product_categories');
    
    // Check if category already exists
    const existing = await categoriesCollection.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Cette catégorie existe déjà'
      });
    }

    const categoryData = {
      name: name.trim(),
      created_at: new Date()
    };

    const result = await categoriesCollection.insertOne(categoryData);

    res.status(201).json({
      success: true,
      message: 'Catégorie créée avec succès',
      data: {
        id: result.insertedId,
        ...categoryData
      }
    });
  } catch (error) {
    if (error.code === 11000) { // MongoDB duplicate key
      return res.status(400).json({
        success: false,
        message: 'Cette catégorie existe déjà'
      });
    }
    console.error('Error creating category:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la catégorie',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/categories/:id - Delete category
router.delete('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const categoriesCollection = await getCollection('product_categories');
    const result = await categoriesCollection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    res.json({
      success: true,
      message: 'Catégorie supprimée'
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la catégorie',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PUT /api/admin/products/:id/archive - Archive/unarchive product
router.put('/products/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const { archived } = req.body;

    const productsCollection = await getCollection('products');
    const result = await productsCollection.updateOne(
      { _id: id },
      { $set: { archived: archived !== false } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    const product = await productsCollection.findOne({ _id: id });
    res.json({
      success: true,
      message: archived ? 'Produit archivé' : 'Produit désarchivé',
      data: {
        id: product._id,
        archived: product.archived
      }
    });
  } catch (error) {
    console.error('Error archiving product:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'archivage',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/products/:id/variants - Get product variants
router.get('/products/:id/variants', async (req, res) => {
  try {
    const { id } = req.params;

    const variantsCollection = await getCollection('product_variants');
    const variants = await variantsCollection.find({ product_id: id })
      .sort({ created_at: 1 })
      .toArray();

    res.json({
      success: true,
      data: variants.map(variant => ({
        id: variant._id,
        ...variant,
        stock: parseInt(variant.stock || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des variantes',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// POST /api/admin/products/:id/variants - Create variant
router.post('/products/:id/variants', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, size, flavor, stock } = req.body;

    const variantsCollection = await getCollection('product_variants');
    
    const variantData = {
      product_id: id,
      name: name || null,
      color: color || null,
      size: size || null,
      flavor: flavor || null,
      stock: stock || 0,
      created_at: new Date()
    };

    const result = await variantsCollection.insertOne(variantData);

    res.status(201).json({
      success: true,
      message: 'Variante créée',
      data: {
        id: result.insertedId,
        ...variantData
      }
    });
  } catch (error) {
    console.error('Error creating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la variante',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PUT /api/admin/products/variants/:variantId - Update variant
router.put('/products/variants/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;
    const { name, color, size, flavor, stock } = req.body;

    const variantsCollection = await getCollection('product_variants');
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (size !== undefined) updateData.size = size;
    if (flavor !== undefined) updateData.flavor = flavor;
    if (stock !== undefined) updateData.stock = parseInt(stock);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    const result = await variantsCollection.updateOne(
      { _id: variantId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Variante non trouvée'
      });
    }

    const updated = await variantsCollection.findOne({ _id: variantId });
    res.json({
      success: true,
      message: 'Variante mise à jour',
      data: {
        id: updated._id,
        ...updated
      }
    });
  } catch (error) {
    console.error('Error updating variant:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la variante',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/products/variants/:variantId - Delete variant
router.delete('/products/variants/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;

    const variantsCollection = await getCollection('product_variants');
    const result = await variantsCollection.deleteOne({ _id: variantId });

    if (result.deletedCount === 0) {
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/products/collections - Get all collections
router.get('/products/collections', async (req, res) => {
  try {
    const collectionsCollection = await getCollection('product_collections');
    const collections = await collectionsCollection.find({})
      .sort({ name: 1 })
      .toArray();

    res.json({
      success: true,
      data: collections.map(c => ({ id: c._id, ...c }))
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des collections',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const collectionsCollection = await getCollection('product_collections');
    
    const collectionData = {
      name,
      description: description || null,
      image: image || null,
      created_at: new Date()
    };

    const result = await collectionsCollection.insertOne(collectionData);

    res.status(201).json({
      success: true,
      message: 'Collection créée',
      data: {
        id: result.insertedId,
        ...collectionData
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Une collection avec ce nom existe déjà'
      });
    }
    console.error('Error creating collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la collection',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const collectionsCollection = await getCollection('product_collections');
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    const result = await collectionsCollection.updateOne(
      { _id: id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Collection non trouvée'
      });
    }

    const updated = await collectionsCollection.findOne({ _id: id });
    res.json({
      success: true,
      message: 'Collection mise à jour',
      data: {
        id: updated._id,
        ...updated
      }
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la collection',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/products/collections/:id - Delete collection
router.delete('/products/collections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const collectionsCollection = await getCollection('product_collections');
    const result = await collectionsCollection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const productsCollection = await getCollection('products');
    const stockMovementsCollection = await getCollection('stock_movements');
    
    try {
      // Get current stock
      const product = await productsCollection.findOne({ _id: id });
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Produit non trouvé'
        });
      }

      const currentStock = parseInt(product.stock || 0);
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
      await productsCollection.updateOne(
        { _id: id },
        { $set: { stock: newStock } }
      );

      // Record stock movement
      await stockMovementsCollection.insertOne({
        product_id: id,
        movement_type,
        quantity,
        previous_stock: currentStock,
        new_stock: newStock,
        notes: notes || null,
        created_by: userId,
        created_at: new Date()
      });

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
      throw error;
    }
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du stock',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/products/:id/stock-history - Get stock history
router.get('/products/:id/stock-history', async (req, res) => {
  try {
    const { id } = req.params;

    const stockMovementsCollection = await getCollection('stock_movements');
    const usersCollection = await getCollection('users');

    const movements = await stockMovementsCollection.find({ product_id: id })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray();

    const movementsWithUsers = await Promise.all(movements.map(async (sm) => {
      const user = sm.created_by ? await usersCollection.findOne({ _id: sm.created_by }) : null;
      return {
        id: sm._id,
        ...sm,
        created_by_name: user?.name || null,
        quantity: parseInt(sm.quantity),
        previous_stock: parseInt(sm.previous_stock || 0),
        new_stock: parseInt(sm.new_stock || 0)
      };
    }));

    res.json({
      success: true,
      data: movementsWithUsers
    });
  } catch (error) {
    console.error('Error fetching stock history:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/products/export - Export products to CSV
router.get('/products/export', async (req, res) => {
  try {
    const productsCollection = await getCollection('products');
    const products = await productsCollection.find({ archived: false })
      .sort({ created_at: -1 })
      .toArray();

    // Create CSV manually with proper formatting
    const headers = ['ID', 'Titre', 'Description', 'Prix TTC', 'Prix HT', 'TVA %', 'Catégorie', 'Collection', 'Stock', 'Seuil alerte', 'Statut', 'Date création'];
    const csvRows = [headers.join(',')];

    products.forEach(row => {
      const values = [
        row._id,
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// ========== MESSAGES ==========

// GET /api/admin/messages - List contact form messages
router.get('/messages', async (req, res) => {
  try {
    const { read, subject } = req.query;
    const messagesCollection = await getCollection('contact_messages');
    
    const query = {};
    if (read !== undefined) query.read = read === 'true';
    if (subject) query.subject = { $regex: subject, $options: 'i' };

    const messages = await messagesCollection.find(query)
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      success: true,
      data: messages.map(m => ({
        id: m._id,
        name: m.name,
        email: m.email,
        subject: m.subject,
        message: m.message,
        read: m.read,
        created_at: m.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const messagesCollection = await getCollection('contact_messages');
    const result = await messagesCollection.updateOne(
      { _id: id },
      { $set: { read: read } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    const updated = await messagesCollection.findOne({ _id: id });
    res.json({
      success: true,
      message: 'Message mis à jour',
      data: {
        id: updated._id,
        name: updated.name,
        email: updated.email,
        subject: updated.subject,
        message: updated.message,
        read: updated.read,
        created_at: updated.created_at
      }
    });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du message',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/messages/:id - Delete message
router.delete('/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const messagesCollection = await getCollection('contact_messages');
    const result = await messagesCollection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const usersCollection = await getCollection('users');
    const productsCollection = await getCollection('products');
    const messagesCollection = await getCollection('contact_messages');
    const ordersCollection = await getCollection('orders');
    const orderItemsCollection = await getCollection('order_items');
    const workshopsCollection = await getCollection('workshops');
    const reservationsCollection = await getCollection('reservations');
    const blogsCollection = await getCollection('blog_posts');

    // Date range filter for MongoDB
    const dateQuery = {};
    if (start_date && end_date) {
      dateQuery.created_at = { $gte: new Date(start_date), $lte: new Date(end_date) };
    } else if (start_date) {
      dateQuery.created_at = { $gte: new Date(start_date) };
    } else if (end_date) {
      dateQuery.created_at = { $lte: new Date(end_date) };
    }

    // Get users count
    const usersCount = await usersCollection.countDocuments({});

    // Get products count (not archived)
    const productsCount = await productsCollection.countDocuments({ archived: false });

    // Get messages count
    const messagesCount = await messagesCollection.countDocuments({});

    // Get unread messages count
    const unreadCount = await messagesCollection.countDocuments({ read: false });

    // Get real revenue (from orders)
    const revenueOrders = await ordersCollection.find({
      status: { $nin: ['cancelled', 'refunded'] },
      ...dateQuery
    }).toArray();
    const revenue = revenueOrders.reduce((sum, order) => sum + parseFloat(order.total || 0), 0);

    // Get orders count
    const ordersCount = await ordersCollection.countDocuments(dateQuery);

    // Get sales data by month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const salesOrders = await ordersCollection.find({
      status: { $nin: ['cancelled', 'refunded'] },
      created_at: { $gte: sixMonthsAgo }
    }).toArray();

    const salesByMonth = salesOrders.reduce((acc, order) => {
      const month = new Date(order.created_at).toLocaleString('en', { month: 'short' });
      if (!acc[month]) acc[month] = 0;
      acc[month] += parseFloat(order.total || 0);
      return acc;
    }, {});

    const salesData = Object.keys(salesByMonth).map(month => ({
      month,
      sales: salesByMonth[month]
    }));

    // Get category distribution (real data)
    const validOrders = await ordersCollection.find({
      status: { $nin: ['cancelled', 'refunded'] },
      ...dateQuery
    }).toArray();
    const validOrderIds = validOrders.map(o => o._id);

    const orderItems = await orderItemsCollection.find({
      order_id: { $in: validOrderIds }
    }).toArray();

    const categoryTotals = {};
    for (const item of orderItems) {
      const product = await productsCollection.findOne({ _id: item.product_id });
      const category = product?.category || 'Sans catégorie';
      if (!categoryTotals[category]) categoryTotals[category] = 0;
      categoryTotals[category] += parseInt(item.quantity || 0);
    }

    const categoryData = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    // Get top products
    const productSales = {};
    for (const item of orderItems) {
      const productId = item.product_id;
      if (!productSales[productId]) {
        const product = await productsCollection.findOne({ _id: productId });
        productSales[productId] = {
          id: productId,
          title: product?.title || 'Unknown',
          sold: 0
        };
      }
      productSales[productId].sold += parseInt(item.quantity || 0);
    }

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    // Get user registrations by month (last 6 months)
    const recentUsers = await usersCollection.find({
      created_at: { $gte: sixMonthsAgo }
    }).toArray();

    const usersByMonth = recentUsers.reduce((acc, user) => {
      const month = new Date(user.created_at).toLocaleString('en', { month: 'short' });
      if (!acc[month]) acc[month] = 0;
      acc[month]++;
      return acc;
    }, {});

    const registrationsData = Object.keys(usersByMonth).map(month => ({
      month,
      users: usersByMonth[month]
    }));

    // Get workshop stats
    const workshopsCount = await workshopsCollection.countDocuments({ status: 'active' });

    const bookingsCount = await reservationsCollection.countDocuments({
      status: 'confirmed',
      cancelled_at: null
    });

    // Get blogs count
    const blogsCount = await blogsCollection.countDocuments({
      $or: [{ published: true }, { published: { $exists: false } }]
    });

    // Get gift cards count
    const giftCardsCollection = await getCollection('gift_cards');
    const giftCardsCount = await giftCardsCollection.countDocuments({ status: 'active' });

    // Get order status breakdown
    const orderStatusAggregation = await ordersCollection.aggregate([
      ...(Object.keys(dateQuery).length > 0 ? [{ $match: dateQuery }] : []),
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    const orderStatusData = orderStatusAggregation.map(row => ({
      status: row._id,
      count: row.count
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
        blogs: blogsCount,
        giftCards: giftCardsCount,
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// ========== SETTINGS ==========

// GET /api/admin/settings - Get site settings
router.get('/settings', async (req, res) => {
  try {
    const settingsCollection = await getCollection('site_settings');
    const settingsDocs = await settingsCollection.find({})
      .sort({ key: 1 })
      .toArray();

    const settings = {};
    settingsDocs.forEach(doc => {
      settings[doc.key] = doc.value;
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PUT /api/admin/settings - Update site settings
router.put('/settings', async (req, res) => {
  try {
    const settings = req.body;

    const settingsCollection = await getCollection('site_settings');
    
    // Update each setting
    for (const [key, value] of Object.entries(settings)) {
      await settingsCollection.updateOne(
        { key: key },
        {
          $set: {
            value: value,
            updated_at: new Date()
          }
        },
        { upsert: true }
      );
    }

    // Get updated settings
    const settingsDocs = await settingsCollection.find({})
      .sort({ key: 1 })
      .toArray();

    const updatedSettings = {};
    settingsDocs.forEach(doc => {
      updatedSettings[doc.key] = doc.value;
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// ========== BLOGS ==========

// GET /api/admin/blogs - List all blogs
router.get('/blogs', async (req, res) => {
  try {
    const blogsCollection = await getCollection('blog_posts');
    const blogs = await blogsCollection.find({})
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      success: true,
      data: blogs.map(blog => ({
        id: blog._id,
        title: blog.title,
        excerpt: blog.excerpt,
        content: blog.content,
        image: blog.image,
        author: blog.author,
        category: blog.category,
        slug: blog.slug,
        published: blog.published,
        created_at: blog.created_at,
        updated_at: blog.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des blogs',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/blogs/:id - Get single blog
router.get('/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const blogsCollection = await getCollection('blog_posts');
    const blog = await blogsCollection.findOne({ _id: id });

    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        id: blog._id,
        ...blog
      }
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du blog',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    const blogsCollection = await getCollection('blog_posts');
    
    // Ensure slug is unique
    const existingSlug = await blogsCollection.findOne({ slug: finalSlug });

    if (existingSlug) {
      finalSlug = `${finalSlug}-${Date.now()}`;
    }

    const blogData = {
      title,
      content,
      excerpt: excerpt || null,
      image: image || null,
      author: author || null,
      category: category || null,
      slug: finalSlug,
      published: published !== false,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await blogsCollection.insertOne(blogData);

    res.status(201).json({
      success: true,
      message: 'Blog créé avec succès',
      data: {
        id: result.insertedId,
        ...blogData
      }
    });
  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du blog',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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
    const blogsCollection = await getCollection('blog_posts');
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (image !== undefined) updateData.image = image;
    if (author !== undefined) updateData.author = author;
    if (category !== undefined) updateData.category = category;
    if (published !== undefined) updateData.published = published;

    if (slug !== undefined) {
      // Check if slug is unique (excluding current blog)
      const existingSlug = await blogsCollection.findOne({ slug: slug, _id: { $ne: id } });
      if (existingSlug) {
        return res.status(400).json({
          success: false,
          message: 'Ce slug est déjà utilisé'
        });
      }
      updateData.slug = slug;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    updateData.updated_at = new Date();

    const result = await blogsCollection.updateOne(
      { _id: id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog non trouvé'
      });
    }

    const updated = await blogsCollection.findOne({ _id: id });
    res.json({
      success: true,
      message: 'Blog mis à jour',
      data: {
        id: updated._id,
        ...updated
      }
    });
  } catch (error) {
    console.error('Error updating blog:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du blog',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/blogs/:id - Delete blog
router.delete('/blogs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const blogsCollection = await getCollection('blog_posts');
    const result = await blogsCollection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
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
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

