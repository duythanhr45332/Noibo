const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');

class UpdateCustomer {
  constructor({ customerRepository, auditLogRepository, logger }) {
    this.customerRepository = customerRepository;
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async execute(customerId, payload, { actorId = null } = {}) {
    const existing = await this.customerRepository.findById(customerId);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy khách hàng', 'customerId');
    }

    const updated = await this.customerRepository.update(customerId, payload);

    if (this.auditLogRepository) {
      try {
        await this.auditLogRepository.create({
          entity_name: 'customers',
          entity_id: customerId,
          action: 'UPDATE_CUSTOMER',
          old_values: existing,
          new_values: updated,
          changed_by: actorId,
        });
      } catch (err) {
        if (this.logger) this.logger.warn('AuditLog UpdateCustomer error:', err);
      }
    }

    return updated;
  }
}

module.exports = UpdateCustomer;
