class LogScopeMandays {
  constructor({ scopeItemRepository }) {
    this.scopeItemRepository = scopeItemRepository;
  }

  async execute(scopeItemId, input, { actorId = null } = {}) {
    return this.scopeItemRepository.logMandaysTransaction(scopeItemId, input, actorId);
  }
}

module.exports = LogScopeMandays;
