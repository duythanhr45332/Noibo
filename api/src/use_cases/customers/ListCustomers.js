const { ROLES } = require('../../domain/constants/roles');

class ListCustomers {
  constructor({ customerRepository }) {
    this.customerRepository = customerRepository;
  }

  async execute({ page = 1, limit = 20, search = '', actorRole = null } = {}) {
    const result = await this.customerRepository.findAllPaginated({
      page,
      limit,
      search,
    });

    if (actorRole === ROLES.PM) {
      result.items = result.items.map((item) => ({
        ...item,
        total_contract_value: null,
      }));
    }

    return result;
  }
}

module.exports = ListCustomers;
