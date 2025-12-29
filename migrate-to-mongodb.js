import pg from 'pg';
import { connectToMongoDB, getDB, closeConnection } from './db-mongodb.js';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL connection
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper to convert PostgreSQL UUID to MongoDB ObjectId or keep as string
function convertId(id) {
  // MongoDB uses ObjectId, but we can keep UUIDs as strings for compatibility
  return id;
}

// Helper to convert PostgreSQL timestamp to MongoDB Date
function convertDate(date) {
  return date ? new Date(date) : new Date();
}

// Helper to convert decimal to number
function convertDecimal(value) {
  return value ? parseFloat(value) : null;
}

// Helper to convert JSONB to array
function convertJSONB(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

async function migrateTable(tableName, transformFn = null) {
  try {
    console.log(`\n📦 Migrating ${tableName}...`);
    
    // Check if table exists
    const tableExists = await pgPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `, [tableName]);
    
    if (!tableExists.rows[0].exists) {
      console.log(`   ⚠️  Table ${tableName} does not exist, skipping...`);
      return 0;
    }
    
    // Get data from PostgreSQL
    const result = await pgPool.query(`SELECT * FROM ${tableName}`);
    const rows = result.rows;
    
    if (rows.length === 0) {
      console.log(`   ⚠️  No data found in ${tableName}`);
      return 0;
    }
    
    // Get MongoDB collection
    const db = await getDB();
    const collection = db.collection(tableName);
    
    // Transform and insert data
    const documents = rows.map(row => {
      let doc = { ...row };
      
      // Convert common fields
      if (doc.id) {
        doc._id = convertId(doc.id);
        delete doc.id;
      }
      
      if (doc.created_at) {
        doc.created_at = convertDate(doc.created_at);
      }
      
      if (doc.updated_at) {
        doc.updated_at = convertDate(doc.updated_at);
      }
      
      if (doc.cancelled_at) {
        doc.cancelled_at = convertDate(doc.cancelled_at);
      }
      
      if (doc.refunded_at) {
        doc.refunded_at = convertDate(doc.refunded_at);
      }
      
      if (doc.workshop_date) {
        doc.workshop_date = convertDate(doc.workshop_date);
      }
      
      if (doc.session_date) {
        doc.session_date = convertDate(doc.session_date);
      }
      
      if (doc.expiry_date) {
        doc.expiry_date = convertDate(doc.expiry_date);
      }
      
      // Convert decimal fields
      if (doc.price) doc.price = convertDecimal(doc.price);
      if (doc.total) doc.total = convertDecimal(doc.total);
      if (doc.amount) doc.amount = convertDecimal(doc.amount);
      if (doc.balance) doc.balance = convertDecimal(doc.balance);
      if (doc.price_ht) doc.price_ht = convertDecimal(doc.price_ht);
      if (doc.tva_rate) doc.tva_rate = convertDecimal(doc.tva_rate);
      if (doc.refund_amount) doc.refund_amount = convertDecimal(doc.refund_amount);
      if (doc.total_spent) doc.total_spent = convertDecimal(doc.total_spent);
      if (doc.last_order_date) doc.last_order_date = convertDate(doc.last_order_date);
      
      // Convert JSONB fields
      if (doc.images) doc.images = convertJSONB(doc.images);
      if (doc.features) doc.features = convertJSONB(doc.features);
      
      // Apply custom transform if provided
      if (transformFn) {
        doc = transformFn(doc, row);
      }
      
      return doc;
    });
    
    // Insert into MongoDB
    if (documents.length > 0) {
      // Clear existing data (optional - comment out if you want to keep existing data)
      await collection.deleteMany({});
      
      const insertResult = await collection.insertMany(documents);
      console.log(`   ✅ Migrated ${insertResult.insertedCount} documents to ${tableName}`);
      return insertResult.insertedCount;
    }
    
    return 0;
  } catch (error) {
    console.error(`   ❌ Error migrating ${tableName}:`, error.message);
    throw error;
  }
}

async function migrateAll() {
  try {
    console.log('🚀 Starting migration from PostgreSQL to MongoDB Atlas...\n');
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Test PostgreSQL connection
    const pgTest = await pgPool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connected');
    console.log('✅ MongoDB connected\n');
    
    // Migrate tables in order (respecting foreign key dependencies)
    const migrations = [
      // Independent tables first
      { table: 'users' },
      { table: 'product_categories' },
      { table: 'product_collections' },
      { table: 'site_settings' },
      
      // Products and related
      { 
        table: 'products',
        transform: (doc) => {
          // Convert images JSONB to array
          if (doc.images && typeof doc.images === 'string') {
            try {
              doc.images = JSON.parse(doc.images);
            } catch {
              doc.images = doc.image ? [doc.image] : [];
            }
          }
          if (!doc.images || doc.images.length === 0) {
            doc.images = doc.image ? [doc.image] : [];
          }
          return doc;
        }
      },
      { table: 'product_variants' },
      
      // Workshops and related
      { 
        table: 'workshops',
        transform: (doc) => {
          // Convert images JSONB to array
          if (doc.images && typeof doc.images === 'string') {
            try {
              doc.images = JSON.parse(doc.images);
            } catch {
              doc.images = doc.image ? [doc.image] : [];
            }
          }
          if (!doc.images || doc.images.length === 0) {
            doc.images = doc.image ? [doc.image] : [];
          }
          return doc;
        }
      },
      { table: 'workshop_sessions' },
      
      // Orders and related
      { table: 'orders' },
      { table: 'order_items' },
      { table: 'reservations' },
      
      // Other tables
      { table: 'blog_posts' },
      { table: 'contact_messages' },
      { table: 'clients' },
      { table: 'gift_cards' },
      { table: 'gift_card_transactions' },
      { table: 'stock_movements' },
    ];
    
    let totalMigrated = 0;
    
    for (const migration of migrations) {
      const count = await migrateTable(migration.table, migration.transform);
      totalMigrated += count;
    }
    
    console.log(`\n✅ Migration completed!`);
    console.log(`📊 Total documents migrated: ${totalMigrated}`);
    
    // Create indexes for better performance
    console.log('\n📇 Creating indexes...');
    const db = await getDB();
    
    // Users indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ role: 1 });
    
    // Products indexes
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('products').createIndex({ status: 1 });
    await db.collection('products').createIndex({ collection: 1 });
    
    // Orders indexes
    await db.collection('orders').createIndex({ user_id: 1 });
    await db.collection('orders').createIndex({ status: 1 });
    await db.collection('orders').createIndex({ payment_status: 1 });
    await db.collection('orders').createIndex({ created_at: -1 });
    
    // Order items indexes
    await db.collection('order_items').createIndex({ order_id: 1 });
    await db.collection('order_items').createIndex({ product_id: 1 });
    
    // Workshops indexes
    await db.collection('workshops').createIndex({ status: 1 });
    await db.collection('workshops').createIndex({ level: 1 });
    
    // Reservations indexes
    await db.collection('reservations').createIndex({ workshop_id: 1 });
    await db.collection('reservations').createIndex({ user_id: 1 });
    await db.collection('reservations').createIndex({ status: 1 });
    await db.collection('reservations').createIndex({ session_id: 1 });
    
    // Workshop sessions indexes
    await db.collection('workshop_sessions').createIndex({ workshop_id: 1 });
    await db.collection('workshop_sessions').createIndex({ session_date: 1 });
    
    // Gift cards indexes
    await db.collection('gift_cards').createIndex({ code: 1 }, { unique: true });
    await db.collection('gift_cards').createIndex({ status: 1 });
    
    // Stock movements indexes
    await db.collection('stock_movements').createIndex({ product_id: 1 });
    await db.collection('stock_movements').createIndex({ created_at: -1 });
    
    // Site settings indexes
    await db.collection('site_settings').createIndex({ key: 1 }, { unique: true });
    
    console.log('✅ Indexes created');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pgPool.end();
    await closeConnection();
  }
}

// Run migration
migrateAll()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

