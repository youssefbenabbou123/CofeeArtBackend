// This file is deprecated. Use db-mongodb.js for MongoDB operations.
// For PostgreSQL migration scripts, use db.postgres.js instead.
// This file exists only to prevent import errors in old migration scripts.

export default null;
export async function testConnection() {
  throw new Error('db.js is deprecated. Use db-mongodb.js for MongoDB or db.postgres.js for PostgreSQL migrations.');
}


