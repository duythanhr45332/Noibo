const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const { stripFinancialFieldsForRole } = require('../../domain/services/contract-finance.service');

class GetContractDetail {
  constructor({ contractRepository }) {
    this.contractRepository = contractRepository;
  }

  async execute(contractId, { actorRole = null } = {}) {
    const contract = await this.contractRepository.findByIdFull(contractId);
    if (!contract) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy hợp đồng', 'contractId');
    }

    return stripFinancialFieldsForRole(contract, actorRole);
  }
}

module.exports = GetContractDetail;
