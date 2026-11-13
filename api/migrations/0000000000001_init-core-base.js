/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // 1. Extensions
  pgm.createExtension('uuid-ossp', { ifNotExists: true });

  // 2. Users table (Minimal Auth Base)
  pgm.createTable('users', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    username: { type: 'varchar(50)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    full_name: { type: 'varchar(100)', notNull: true },
    role: { type: 'varchar(50)', notNull: true, default: 'ADMIN' },
    is_active: { type: 'boolean', default: true },
    deleted_at: { type: 'timestamp', default: null },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('users', 'deleted_at', { name: 'idx_users_deleted_at' });

  // 3. Refresh Tokens table
  pgm.createTable('refresh_tokens', {
    token: { type: 'varchar(64)', primaryKey: true },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: '"users"',
      onDelete: 'CASCADE',
    },
    expires_at: { type: 'timestamp', notNull: true },
    revoked_at: { type: 'timestamp', default: null },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('refresh_tokens', 'user_id', {
    name: 'idx_refresh_tokens_user_id',
  });
  pgm.createIndex('refresh_tokens', 'expires_at', {
    name: 'idx_refresh_tokens_expires_at',
  });
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS notifications, audit_logs, refresh_tokens, users, role_permissions, permissions, roles CASCADE;`);
};
