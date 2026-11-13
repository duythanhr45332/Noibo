class User {
  constructor({
    user_id = null,
    username,
    password_hash,
    full_name,
    role = 'ADMIN',
    is_active = true,
    deleted_at = null,
    created_at = new Date(),
    updated_at = new Date(),
  }) {
    this.user_id = user_id;
    this.username = username;
    this.password_hash = password_hash;
    this.full_name = full_name;
    this.role = role;
    this.is_active = is_active;
    this.deleted_at = deleted_at;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }
}

module.exports = User;
