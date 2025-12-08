import pool from './db.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupGuestOrders() {
  let client;
  try {
    console.log('🔄 Connecting to Railway database...');
    
    if (!process.env.DATABASE_URL) {
      console.error('❌ DATABASE_URL is not set!');
      process.exit(1);
    }

    client = await pool.connect();
    console.log('✅ Connected to Railway database\n');
    
    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', '004_add_guest_order_fields.sql'),
      'utf8'
    );
    
    console.log('🚀 Running migration for guest orders...\n');
    
    // Execute migration - allow NULL user_id
    try {
      await client.query('ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL');
      console.log('✅ Made user_id nullable');
    } catch (error) {
      if (error.code !== '42701') {
        console.log('⚠️  user_id may already be nullable');
      }
    }

    // Add guest fields
    const guestFields = [
      { name: 'guest_name', type: 'VARCHAR(150)' },
      { name: 'guest_email', type: 'VARCHAR(150)' },
      { name: 'guest_phone', type: 'VARCHAR(20)' },
      { name: 'shipping_address', type: 'TEXT' },
      { name: 'shipping_city', type: 'VARCHAR(100)' },
      { name: 'shipping_postal_code', type: 'VARCHAR(20)' },
      { name: 'shipping_country', type: 'VARCHAR(100) DEFAULT \'France\'' },
    ];

    for (const field of guestFields) {
      try {
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS ${field.name} ${field.type}`);
        console.log(`✅ Added column: ${field.name}`);
      } catch (error) {
        if (error.code === '42701' || error.message.includes('already exists')) {
          console.log(`⚠️  Column ${field.name} already exists`);
        } else {
          console.error(`❌ Error adding ${field.name}:`, error.message);
        }
      }
    }

    // Add product_id to order_items
    try {
      await client.query('ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id)');
      console.log('✅ Added product_id to order_items');
    } catch (error) {
      if (error.code === '42701') {
        console.log('⚠️  product_id may already exist');
      }
    }

    // Make product_variant_id nullable
    try {
      await client.query('ALTER TABLE order_items ALTER COLUMN product_variant_id DROP NOT NULL');
      console.log('✅ Made product_variant_id nullable');
    } catch (error) {
      console.log('⚠️  product_variant_id may already be nullable');
    }
    
    // Verify the changes
    const tableInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Orders table structure:');
    tableInfo.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Check order_items
    const itemsInfo = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'order_items' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Order items table structure:');
    itemsInfo.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n🎉 Guest order setup completed successfully!');
    console.log('✅ Users can now place orders without logging in');
    
  } catch (error) {
    console.error('❌ Error setting up guest orders:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(0);
  }
}

setupGuestOrders();

