import { connectToMongoDB, testConnection, closeConnection } from './db-mongodb.js';

async function test() {
  try {
    console.log('🧪 Testing MongoDB Atlas connection...\n');
    
    const result = await testConnection();
    
    console.log('✅ Connection successful!');
    console.log('📊 Connection details:');
    console.log('   - Database:', result.database);
    console.log('   - Server:', result.server);
    console.log('   - Status:', result.connected ? 'Connected ✅' : 'Disconnected ❌');
    
    // Test listing collections
    const db = await connectToMongoDB();
    const collections = await db.listCollections().toArray();
    
    console.log(`\n📦 Collections found: ${collections.length}`);
    if (collections.length > 0) {
      console.log('   Collections:');
      collections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
    } else {
      console.log('   ⚠️  No collections found. Run migration first.');
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check MONGODB_URI in .env file');
    console.error('   2. Verify MongoDB Atlas cluster is running');
    console.error('   3. Check network access in MongoDB Atlas (IP whitelist)');
    console.error('   4. Verify username and password are correct');
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

test();


