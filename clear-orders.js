import pool from './db.js';
import dotenv from 'dotenv';

dotenv.config();

async function clearAllOrders() {
  try {
    console.log('🔄 Clearing all orders from database...');
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete order items first (due to foreign key constraint)
      const itemsResult = await client.query('DELETE FROM order_items RETURNING id');
      console.log(`✅ Deleted ${itemsResult.rowCount} order items`);
      
      // Delete all orders
      const ordersResult = await client.query('DELETE FROM orders RETURNING id');
      console.log(`✅ Deleted ${ordersResult.rowCount} orders`);
      
      await client.query('COMMIT');
      
      console.log('✅ Successfully cleared all orders and order items from database');
      process.exit(0);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('❌ Error clearing orders:', error);
    process.exit(1);
  }
}

clearAllOrders();

