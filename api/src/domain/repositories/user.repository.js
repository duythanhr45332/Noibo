/**
 * Domain Repository Interface cho User.
 * Định nghĩa các phương thức giao tiếp (Abstract Methods) mà Use Cases cần.
 * Không chứa bất kỳ logic cơ sở dữ liệu (SQL) nào ở đây.
 */
class UserRepository {
  async findByUsername(_username) {
    throw new Error('Method not implemented: findByUsername');
  }

  async findById(_userId) {
    throw new Error('Method not implemented: findById');
  }

  async findAllPaginated(_filters) {
    throw new Error('Method not implemented: findAllPaginated');
  }

  async findActiveOptions(_filters) {
    throw new Error('Method not implemented: findActiveOptions');
  }

  async countActiveByRole(_role) {
    throw new Error('Method not implemented: countActiveByRole');
  }

  async create(_userData) {
    throw new Error('Method not implemented: create');
  }

  async update(_userId, _userData) {
    throw new Error('Method not implemented: update');
  }

  async updateStatus(_userId, _isActive) {
    throw new Error('Method not implemented: updateStatus');
  }

  async updatePassword(_userId, _passwordHash) {
    throw new Error('Method not implemented: updatePassword');
  }

  async softDelete(_userId) {
    throw new Error('Method not implemented: softDelete');
  }
}

module.exports = UserRepository;
