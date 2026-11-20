const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');

class DeleteCustomer {
  constructor({ customerRepository, auditLogRepository, logger }) {
    this.customerRepository = customerRepository;
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async execute(customerId, { actorId = null } = {}) {
    const existing = await this.customerRepository.findById(customerId);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy khách hàng', 'customerId');
    }

    const deleted = await this.customerRepository.softDelete(customerId);
    if (!deleted) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy khách hàng', 'customerId');
    }

    if (this.auditLogRepository) {
      try {
        await this.auditLogRepository.create({
          entity_name: 'customers',
          entity_id: customerId,
          action: 'DELETE_CUSTOMER',
          old_values: existing,
          new_values: null,
          changed_by: actorId,
        });
      } catch (err) {
        if (this.logger) this.logger.warn('AuditLog DeleteCustomer error:', err);
      }
    }

    return { customer_id: customerId, deleted: true };
  }
}

module.exports = DeleteCustomer;
