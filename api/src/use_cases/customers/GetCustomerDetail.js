const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const { ROLES } = require('../../domain/constants/roles');

class GetCustomerDetail {
  constructor({ customerRepository }) {
    this.customerRepository = customerRepository;
  }

  async execute(customerId, { actorRole = null } = {}) {
    const customer = await this.customerRepository.findById(customerId);
    if (!customer) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy khách hàng', 'customerId');
    }

    if (actorRole === ROLES.PM) {
      return {
        ...customer,
        total_contract_value: null,
        contracts: (customer.contracts || []).map((c) => ({
          ...c,
          base_contract_value: null,
          approved_upsell_value: null,
        })),
      };
    }

    return customer;
  }
}

module.exports = GetCustomerDetail;
