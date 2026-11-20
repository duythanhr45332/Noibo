class User {
  constructor({
    user_id = null,
    username,
    password_hash = undefined,
    full_name,
    department = null,
    role = 'AM',
    is_active = true,
    deleted_at = null,
    created_at = new Date(),
    updated_at = new Date(),
  }) {
    this.user_id = user_id;
    this.username = username;
    this.password_hash = password_hash;
    this.full_name = full_name;
    this.department = department;
    this.role = role;
    this.is_active = is_active;
    this.deleted_at = deleted_at;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  toSafeObject() {
    return {
      user_id: this.user_id,
      username: this.username,
      full_name: this.full_name,
      department: this.department,
      role: this.role,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

module.exports = User;
