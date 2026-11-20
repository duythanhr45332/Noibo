const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');

class CreateCustomer {
  constructor({ customerRepository, auditLogRepository, logger }) {
    this.customerRepository = customerRepository;
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async execute(payload, { actorId = null } = {}) {
    if (!payload.name || !String(payload.name).trim()) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Tên doanh nghiệp không được để trống', 'name');
    }

    const created = await this.customerRepository.create({
      ...payload,
      name: String(payload.name).trim(),
      tax_code: payload.tax_code ? String(payload.tax_code).trim() : null,
      created_by: actorId,
    });

    if (this.auditLogRepository) {
      try {
        await this.auditLogRepository.create({
          entity_name: 'customers',
          entity_id: created.customer_id,
          action: 'CREATE_CUSTOMER',
          old_values: null,
          new_values: created,
          changed_by: actorId,
        });
      } catch (err) {
        if (this.logger) this.logger.warn('AuditLog CreateCustomer error:', err);
      }
    }

    return created;
  }
}

module.exports = CreateCustomer;
