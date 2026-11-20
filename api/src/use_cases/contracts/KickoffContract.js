class KickoffContract {
  constructor({ scopeItemRepository }) {
    this.scopeItemRepository = scopeItemRepository;
  }

  async execute(contractId, { actorId = null } = {}) {
    return this.scopeItemRepository.kickoffContractTransaction(contractId, actorId);
  }
}

module.exports = KickoffContract;
