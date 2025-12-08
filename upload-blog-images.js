import pool from './db.js';
import cloudinary from './config/cloudinary.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map blog titles to image filenames
const blogImageMap = {
  'Les Secrets de la Céramique Japonaise': 'Les Secrets de la Céramique Japonaise.webp',
  'Guide Complet: Bien Choisir sa Tasse': 'Guide Complet Bien Choisir sa Tasse.jpg',
  'Peinture et Glaçure: L\'Art Décoratif': 'Peinture et Glaçure L\'Art Décoratif.avif',
  'Durabilité: La Céramique Écologique': 'Durabilité La Céramique Écologique.webp',
  'Café & Céramique: L\'Accord Parfait': 'CaféCéramique L\'Accord Parfait.webp',
  'Les Tendances Céramique 2025': 'Les Tendances Céramique 2025.webp',
};

async function uploadBlogImages() {
  let client;
  try {
    console.log('🔄 Connecting to Railway database...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not set!');
      process.exit(1);
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('❌ Cloudinary credentials not set!');
      console.error('Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
      process.exit(1);
    }

    client = await pool.connect();
    console.log('✅ Connected to Railway database');
    console.log('☁️  Cloudinary configured\n');

    // Get all blogs from database
    const blogsResult = await client.query('SELECT id, title, image FROM blog_posts ORDER BY title');
    const blogs = blogsResult.rows;
    
    console.log(`📚 Found ${blogs.length} blogs in database\n`);

    const publicFolder = path.join(__dirname, '..', 'frontend', 'public');
    
    for (const blog of blogs) {
      const imageFilename = blogImageMap[blog.title];
      
      if (!imageFilename) {
        console.log(`⚠️  No image found for: "${blog.title}"`);
        continue;
      }

      const imagePath = path.join(publicFolder, imageFilename);
      
      // Check if image file exists
      if (!fs.existsSync(imagePath)) {
        console.log(`⚠️  Image file not found: ${imageFilename}`);
        continue;
      }

      // Skip if image already exists in database
      if (blog.image && blog.image.includes('cloudinary.com')) {
        console.log(`⏭️  Skipping "${blog.title}" (already has Cloudinary image)`);
        continue;
      }

      console.log(`📤 Uploading image for: "${blog.title}"`);
      console.log(`   File: ${imageFilename}`);

      try {
        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(imagePath, {
          folder: 'coffee-arts-paris/blogs',
          resource_type: 'image',
          transformation: [
            { width: 1200, height: 800, crop: 'limit', quality: 'auto' },
          ],
          public_id: `blog-${blog.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        });

        const cloudinaryUrl = uploadResult.secure_url;
        console.log(`   ✅ Uploaded to Cloudinary: ${cloudinaryUrl}`);

        // Update database
        await client.query(
          'UPDATE blog_posts SET image = $1, updated_at = NOW() WHERE id = $2',
          [cloudinaryUrl, blog.id]
        );

        console.log(`   ✅ Updated database with Cloudinary URL\n`);
      } catch (error) {
        console.error(`   ❌ Error uploading image for "${blog.title}":`, error.message);
        continue;
      }
    }

    // Verify updates
    const updatedBlogs = await client.query(
      'SELECT title, image FROM blog_posts WHERE image IS NOT NULL AND image LIKE \'%cloudinary.com%\''
    );
    
    console.log(`\n🎉 Done! ${updatedBlogs.rows.length} blogs now have Cloudinary images:`);
    updatedBlogs.rows.forEach(blog => {
      console.log(`   ✅ ${blog.title}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(0);
  }
}

uploadBlogImages();

