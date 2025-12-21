import dotenv from 'dotenv';
import pool from '../db.js';

dotenv.config();

async function deleteAllWorkshops() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🗑️  Deleting all workshops and related data...');
    
    // Delete reservations first (foreign key constraint)
    const reservationsResult = await client.query('DELETE FROM reservations RETURNING id');
    console.log(`   ✅ Deleted ${reservationsResult.rowCount} reservations`);
    
    // Delete workshop sessions
    const sessionsResult = await client.query('DELETE FROM workshop_sessions RETURNING id');
    console.log(`   ✅ Deleted ${sessionsResult.rowCount} workshop sessions`);
    
    // Delete workshops
    const workshopsResult = await client.query('DELETE FROM workshops RETURNING id');
    console.log(`   ✅ Deleted ${workshopsResult.rowCount} workshops`);
    
    await client.query('COMMIT');
    console.log('✅ All workshops deleted successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error deleting workshops:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

deleteAllWorkshops();

