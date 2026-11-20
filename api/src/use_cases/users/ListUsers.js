class ListUsers {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ page = 1, limit = 20, search = '', role = '', isActive = null } = {}) {
    return this.userRepository.findAllPaginated({
      page,
      limit,
      search,
      role,
      isActive,
    });
  }
}

module.exports = ListUsers;
