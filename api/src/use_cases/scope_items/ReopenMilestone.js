class ReopenMilestone {
  constructor({ scopeItemRepository }) {
    this.scopeItemRepository = scopeItemRepository;
  }

  async execute(scopeItemId, { reason = '', actorId = null } = {}) {
    return this.scopeItemRepository.reopenMilestoneTransaction(scopeItemId, { reason, actorId });
  }
}

module.exports = ReopenMilestone;
