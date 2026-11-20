class FinishMilestone {
  constructor({ scopeItemRepository }) {
    this.scopeItemRepository = scopeItemRepository;
  }

  async execute(scopeItemId, { note = '', actorId = null } = {}) {
    return this.scopeItemRepository.finishMilestoneTransaction(scopeItemId, { note, actorId });
  }
}

module.exports = FinishMilestone;
