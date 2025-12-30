import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB connection string - MUST be set in environment variables
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'coffee';

if (!MONGODB_URI) {
  console.error('❌ CRITICAL: MONGODB_URI environment variable is not set!');
  console.error('   The application cannot connect to the database without MONGODB_URI.');
  console.error('   Please set MONGODB_URI in your environment variables.');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

let client = null;
let db = null;

// Connect to MongoDB
export async function connectToMongoDB() {
  try {
    if (!client) {
      console.log('🔌 Connecting to MongoDB Atlas...');
      client = new MongoClient(MONGODB_URI);
      await client.connect();
      console.log('✅ Connected to MongoDB Atlas');
      
      db = client.db(DB_NAME);
      console.log(`📦 Using database: ${DB_NAME}`);
    }
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

// Get database instance
export async function getDB() {
  if (!db) {
    await connectToMongoDB();
  }
  return db;
}

// Get collection helper
export async function getCollection(collectionName) {
  const database = await getDB();
  return database.collection(collectionName);
}

// Close connection
export async function closeConnection() {
  if (client) {
    await client.close();
    console.log('🔌 MongoDB connection closed');
    client = null;
    db = null;
  }
}

// Test connection
export async function testConnection() {
  try {
    const database = await getDB();
    const result = await database.admin().ping();
    return {
      connected: result.ok === 1,
      database: DB_NAME,
      server: 'MongoDB Atlas'
    };
  } catch (error) {
    console.error('MongoDB connection test error:', error);
    throw error;
  }
}

// Export default db instance
export default db;


