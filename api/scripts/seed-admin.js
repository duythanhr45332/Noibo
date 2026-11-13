require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

const seedAdmin = async () => {
  try {
    logger.info('Starting Admin User Seeder for ERP-AM...');

    const adminUsername = 'admin_root';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123@';
    const fullName = 'Quản trị viên Hệ thống (Root)';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    const checkResult = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [adminUsername],
    );

    if (checkResult.rows.length > 0) {
      await db.query(
        'UPDATE users SET password_hash = $1, role = $2, is_active = true, deleted_at = NULL WHERE username = $3',
        [passwordHash, 'ADMIN', adminUsername],
      );
      logger.info(`Updated '${adminUsername}' successfully!`);
      process.exit(0);
    }

    const insertQuery = `
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING user_id, username, full_name, role;
    `;
    const result = await db.query(insertQuery, [
      adminUsername,
      passwordHash,
      fullName,
      'ADMIN',
      true,
    ]);
    logger.info('Admin user created successfully:', result.rows[0]);
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed admin user:', error);
    process.exit(1);
  }
};

seedAdmin();
