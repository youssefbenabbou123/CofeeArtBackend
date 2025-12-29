import express from 'express';
import { getCollection } from '../db-mongodb.js';

const router = express.Router();

// GET all published blog posts
router.get('/', async (req, res) => {
  try {
    const collection = await getCollection('blog_posts');
    
    const posts = await collection.find({
      $or: [
        { published: true },
        { published: null }
      ]
    })
    .sort({ created_at: -1 })
    .toArray();

    // Add default values for missing fields
    const postsWithDefaults = posts.map(post => ({
      id: post._id,
      title: post.title,
      excerpt: post.excerpt || null,
      content: post.content,
      image: post.image,
      author: post.author || null,
      category: post.category || null,
      slug: post.slug || post._id,
      created_at: post.created_at,
      updated_at: post.updated_at || post.created_at,
      published: post.published !== false
    }));
    
    res.json({
      success: true,
      data: postsWithDefaults
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blogs',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET blog post by ID or slug
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const collection = await getCollection('blog_posts');
    
    // Check if identifier is UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    const query = isUUID 
      ? { _id: identifier, $or: [{ published: true }, { published: null }] }
      : { slug: identifier, $or: [{ published: true }, { published: null }] };
    
    const post = await collection.findOne(query);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    // Add default values
    const postWithDefaults = {
      id: post._id,
      title: post.title,
      excerpt: post.excerpt || null,
      content: post.content,
      image: post.image,
      author: post.author || null,
      category: post.category || null,
      slug: post.slug || post._id,
      created_at: post.created_at,
      updated_at: post.updated_at || post.created_at,
      published: post.published !== false
    };
    
    res.json({
      success: true,
      data: postWithDefaults
    });
  } catch (error) {
    console.error('Error fetching blog:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blog',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

