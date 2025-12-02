import pool from '../db.js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

// Get email and password from command line arguments or use defaults
const email = process.argv[2] || 'admin@coffeearts.fr';
const password = process.argv[3] || 'admin123';
const name = process.argv[4] || 'Admin User';

async function createAdmin() {
  try {
    console.log('🔐 Creating admin user...');
    
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user to admin
      await pool.query(
        'UPDATE users SET role = $1 WHERE email = $2',
        ['admin', email.toLowerCase()]
      );
      console.log(`✅ User ${email} is now an admin!`);
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: (unchanged - use existing password)`);
    } else {
      // Create new admin user
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [name, email.toLowerCase(), password_hash, 'admin']
      );

      console.log(`✅ Admin user created successfully!`);
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
    }

    console.log('\n🎉 You can now login at /connexion');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();

