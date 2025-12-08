import express from 'express';
import pool from '../db.js';

const router = express.Router();

// GET all published blog posts
router.get('/', async (req, res) => {
  try {
    // Check if new columns exist, if not use basic columns
    let result;
    try {
      result = await pool.query(
        `SELECT id, title, excerpt, content, image, author, category, slug, created_at, updated_at 
         FROM blog_posts 
         WHERE (published IS NULL OR published = true)
         ORDER BY created_at DESC`
      );
    } catch (error) {
      // Fallback to basic columns if migration hasn't run
      if (error.code === '42703') { // column does not exist
        console.log('⚠️  Using basic blog columns (migration not run yet)');
        result = await pool.query(
          `SELECT id, title, content, image, created_at 
           FROM blog_posts 
           ORDER BY created_at DESC`
        );
        // Add default values for missing columns
        result.rows = result.rows.map(row => ({
          ...row,
          excerpt: null,
          author: null,
          category: null,
          slug: row.id,
          published: true,
          updated_at: row.created_at
        }));
      } else {
        throw error;
      }
    }
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching blogs',
      error: error.message
    });
  }
});

// GET blog post by ID or slug
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Check if identifier is UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    
    let result;
    try {
      const query = isUUID 
        ? 'SELECT * FROM blog_posts WHERE id = $1 AND (published IS NULL OR published = true)'
        : 'SELECT * FROM blog_posts WHERE slug = $1 AND (published IS NULL OR published = true)';
      result = await pool.query(query, [identifier]);
    } catch (error) {
      // Fallback if columns don't exist
      if (error.code === '42703') {
        const query = isUUID 
          ? 'SELECT * FROM blog_posts WHERE id = $1'
          : 'SELECT * FROM blog_posts WHERE id = $1'; // Fallback to ID if slug column doesn't exist
        result = await pool.query(query, [identifier]);
        // Add default values
        if (result.rows.length > 0) {
          result.rows[0] = {
            ...result.rows[0],
            excerpt: null,
            author: null,
            category: null,
            slug: result.rows[0].id,
            published: true,
            updated_at: result.rows[0].created_at
          };
        }
      } else {
        throw error;
      }
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
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
      message: 'Error fetching blog',
      error: error.message
    });
  }
});

export default router;

