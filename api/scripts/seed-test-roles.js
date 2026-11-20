require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/database');
const { ROLES } = require('../src/domain/constants/roles');

const TEST_ACCOUNTS = [
  {
    username: 'admin_test',
    full_name: 'Tài khoản Test - Quản trị viên (ADMIN)',
    department: 'Phòng Công nghệ & Hệ thống',
    role: ROLES.ADMIN,
  },
  {
    username: 'bod_test',
    full_name: 'Tài khoản Test - Ban Giám Đốc (BOD)',
    department: 'Ban Điều Hành',
    role: ROLES.BOD,
  },
  {
    username: 'ketoan_test',
    full_name: 'Tài khoản Test - Kế toán (ACCOUNTANT)',
    department: 'Phòng Tài chính - Kế toán',
    role: ROLES.ACCOUNTANT,
  },
  {
    username: 'am_test',
    full_name: 'Tài khoản Test - Account Manager (AM)',
    department: 'Khối Quản trị Khách hàng (AM)',
    role: ROLES.AM,
  },
  {
    username: 'pm_test',
    full_name: 'Tài khoản Test - Project Manager (PM)',
    department: 'Khối Triển khai Dự án (PM)',
    role: ROLES.PM,
  },
];

async function run() {
  const defaultPassword = process.env.TEST_ROLE_PASSWORD || 'Test@1234';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  for (const acc of TEST_ACCOUNTS) {
    const existing = await db.query(
      'SELECT user_id FROM users WHERE username = $1 AND deleted_at IS NULL',
      [acc.username]
    );
    if (existing.rows.length > 0) {
      await db.query(
        `
          UPDATE users
          SET password_hash = $1, full_name = $2, department = $3, role = $4, is_active = true, updated_at = NOW()
          WHERE user_id = $5
        `,
        [passwordHash, acc.full_name, acc.department, acc.role, existing.rows[0].user_id]
      );
      console.log(`UPDATED: ${acc.username} (${acc.role})`);
    } else {
      await db.query(
        `
          INSERT INTO users (username, password_hash, full_name, department, role, is_active)
          VALUES ($1, $2, $3, $4, $5, true)
        `,
        [acc.username, passwordHash, acc.full_name, acc.department, acc.role]
      );
      console.log(`CREATED: ${acc.username} (${acc.role})`);
    }
  }

  process.exit(0);
}

run().catch((err) => {
  console.error('Failed to seed test role accounts:', err);
  process.exit(1);
});
