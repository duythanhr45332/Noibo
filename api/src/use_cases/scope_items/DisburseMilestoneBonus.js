class DisburseMilestoneBonus {
  constructor({ scopeItemRepository }) {
    this.scopeItemRepository = scopeItemRepository;
  }

  async execute(scopeItemId, { note = '', actorId = null } = {}) {
    return this.scopeItemRepository.disburseBonusTransaction(scopeItemId, {
      note,
      actorId,
    });
  }
}

module.exports = DisburseMilestoneBonus;
