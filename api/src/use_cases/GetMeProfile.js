class GetMeProfile {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId) {
    if (!userId) {
      const error = new Error('Không xác định được danh tính người dùng');
      error.statusCode = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      const error = new Error('Không tìm thấy thông tin người dùng');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    if (!user.is_active) {
      const error = new Error('Tài khoản đã bị vô hiệu hóa');
      error.statusCode = 403;
      error.code = 'ACCOUNT_DISABLED';
      throw error;
    }

    return {
      id: user.user_id,
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      department: user.department || null,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }
}

module.exports = GetMeProfile;
