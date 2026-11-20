class GetActiveUsersDropdown {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ role = '' } = {}) {
    return this.userRepository.findActiveOptions({ role });
  }
}

module.exports = GetActiveUsersDropdown;
