/**
 * Domain Repository Interface cho User.
 * Định nghĩa các phương thức giao tiếp (Abstract Methods) mà Use Cases cần.
 * Không chứa bất kỳ logic cơ sở dữ liệu (SQL) nào ở đây.
 */
class UserRepository {
    async findByUsername(username) {
        throw new Error('Method not implemented: findByUsername');
    }

    async create(userData) {
        throw new Error('Method not implemented: create');
    }

    async updateRole(userId, roleId) {
        throw new Error('Method not implemented: updateRole');
    }

    async searchUsers(page, limit, searchKeyword) {
        throw new Error('Method not implemented: searchUsers');
    }

    async findById(userId) {
        throw new Error('Method not implemented: findById');
    }

    async findByIdWithRole(userId) {
        throw new Error('Method not implemented: findByIdWithRole');
    }

    async updateInfo(userId, userData) {
        throw new Error('Method not implemented: updateInfo');
    }

    async softDelete(userId) {
        throw new Error('Method not implemented: softDelete');
    }
    async countByRole(roleId) {
        throw new Error('Method not implemented: countByRole');
    }
}

module.exports = UserRepository;
