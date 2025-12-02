import pool from '../db.js';
import cloudinary from '../config/cloudinary.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function uploadImagesToCloudinary() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Fetching products from database...');
    
    // Get all products with local image paths
    const result = await client.query(
      "SELECT id, title, image FROM products WHERE image IS NOT NULL AND image NOT LIKE 'https://%' AND image NOT LIKE 'http://%'"
    );
    
    console.log(`📦 Found ${result.rows.length} products with local images to upload\n`);
    
    for (const product of result.rows) {
      try {
        // Get the image path (remove leading slash if present)
        const imagePath = product.image.startsWith('/') ? product.image.slice(1) : product.image;
        const fullPath = join(__dirname, '../../public', imagePath);
        
        console.log(`📤 Uploading: ${product.title} (${imagePath})`);
        
        // Read the image file
        const imageBuffer = readFileSync(fullPath);
        const base64Image = `data:image/${imagePath.split('.').pop()};base64,${imageBuffer.toString('base64')}`;
        
        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(base64Image, {
          folder: 'coffee-arts-paris/products',
          resource_type: 'image',
          public_id: `product-${product.id}-${product.title.toLowerCase().replace(/\s+/g, '-')}`,
          transformation: [
            { width: 1200, height: 1200, crop: 'limit', quality: 'auto' },
          ],
        });
        
        // Update database with Cloudinary URL
        await client.query(
          'UPDATE products SET image = $1 WHERE id = $2',
          [uploadResult.secure_url, product.id]
        );
        
        console.log(`✅ Uploaded and updated: ${product.title}`);
        console.log(`   Cloudinary URL: ${uploadResult.secure_url}\n`);
        
      } catch (error) {
        console.error(`❌ Error uploading ${product.title}:`, error.message);
        // Continue with next product
      }
    }
    
    console.log('✅ All images uploaded to Cloudinary!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

uploadImagesToCloudinary();

