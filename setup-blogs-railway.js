import pool from './db.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupBlogsTable() {
  let client;
  try {
    console.log('🔄 Connecting to Railway database...');
    console.log('📍 Database URL:', process.env.DATABASE_URL ? 'Set ✅' : 'NOT SET ❌');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not set!');
      process.exit(1);
    }

    client = await pool.connect();
    console.log('✅ Connected to Railway database');
    
    // Check if columns already exist
    const checkColumns = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'blog_posts' AND column_name IN ('author', 'category', 'excerpt', 'slug', 'published', 'updated_at')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    console.log('📊 Existing columns:', existingColumns);
    
    // Add columns that don't exist (one at a time to handle UNIQUE constraint)
    if (!existingColumns.includes('author')) {
      console.log('➕ Adding author column...');
      await client.query('ALTER TABLE blog_posts ADD COLUMN author VARCHAR(150)');
    }
    if (!existingColumns.includes('category')) {
      console.log('➕ Adding category column...');
      await client.query('ALTER TABLE blog_posts ADD COLUMN category VARCHAR(100)');
    }
    if (!existingColumns.includes('excerpt')) {
      console.log('➕ Adding excerpt column...');
      await client.query('ALTER TABLE blog_posts ADD COLUMN excerpt TEXT');
    }
    if (!existingColumns.includes('slug')) {
      console.log('➕ Adding slug column...');
      // First add without UNIQUE, then add unique constraint
      await client.query('ALTER TABLE blog_posts ADD COLUMN slug VARCHAR(255)');
      // Generate slugs for existing rows
      const existingRows = await client.query('SELECT id FROM blog_posts WHERE slug IS NULL');
      for (const row of existingRows.rows) {
        await client.query('UPDATE blog_posts SET slug = $1 WHERE id = $2', [row.id, row.id]);
      }
      // Now add unique constraint
      try {
        await client.query('ALTER TABLE blog_posts ADD CONSTRAINT blog_posts_slug_unique UNIQUE (slug)');
      } catch (error) {
        console.log('⚠️  Unique constraint may already exist');
      }
    }
    if (!existingColumns.includes('published')) {
      console.log('➕ Adding published column...');
      await client.query('ALTER TABLE blog_posts ADD COLUMN published BOOLEAN DEFAULT true');
    }
    if (!existingColumns.includes('updated_at')) {
      console.log('➕ Adding updated_at column...');
      await client.query('ALTER TABLE blog_posts ADD COLUMN updated_at TIMESTAMP DEFAULT now()');
    }
    
    // Re-check columns after adding
    const finalCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'blog_posts' AND column_name IN ('author', 'category', 'excerpt', 'slug', 'published', 'updated_at')
    `);
    if (finalCheck.rows.length === 6) {
      console.log('✅ All columns are now present');
    }
    
    // Create indexes
    console.log('🔍 Creating indexes...');
    try {
      await client.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at DESC)');
      console.log('✅ Indexes created');
    } catch (error) {
      console.log('⚠️  Indexes may already exist:', error.message);
    }
    
    // Verify the table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'blog_posts' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Blog posts table structure:');
    tableInfo.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    console.log('\n🎉 Blog table setup completed successfully!');
    console.log('✅ You can now create blogs from the admin panel and they will be saved to Railway database');
    
  } catch (error) {
    console.error('❌ Error setting up blog table:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(0);
  }
}

setupBlogsTable();

