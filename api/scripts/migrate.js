const runner = require('node-pg-migrate').runner;
const { Pool } = require('pg');
require('dotenv').config();

async function runMigrations() {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'postgres',
    database: process.env.DB_NAME || 'erp_am_db',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  const client = await pool.connect();

  try {
    console.log(`Starting migrations: ${direction}...`);
    await runner({
      dbClient: client,
      dir: 'migrations',
      direction: direction,
      migrationsTable: 'pgmigrations',
      log: console.log,
      count: direction === 'down' ? 1 : undefined,
      checkOrder: false,
    });
    console.log(`Migrations ${direction} completed successfully.`);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
