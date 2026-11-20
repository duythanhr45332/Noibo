const { stripFinancialFieldsForRole } = require('../../domain/services/contract-finance.service');

class ListContracts {
  constructor({ contractRepository }) {
    this.contractRepository = contractRepository;
  }

  async execute(filters = {}, { actorRole = null } = {}) {
    const result = await this.contractRepository.findAllPaginated(filters);
    result.items = result.items.map((item) => stripFinancialFieldsForRole(item, actorRole));
    return result;
  }
}

module.exports = ListContracts;
