const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const { ROLES } = require('../../domain/constants/roles');
const {
  computeTaxBreakdownFromItems,
  computeContractCredit,
  computeInstallmentVatParts,
  validateScopeLimits,
  stripFinancialFieldsForRole,
} = require('../../domain/services/contract-finance.service');

class CreateContract {
  constructor({ contractRepository, customerRepository, logger }) {
    this.contractRepository = contractRepository;
    this.customerRepository = customerRepository;
    this.logger = logger;
  }

  async execute(payload, { actorId = null, actorRole = null } = {}) {
    if (!payload.scope_items || payload.scope_items.length === 0) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'Hợp đồng phải có ít nhất 1 Mốc bàn giao kỹ thuật',
        'scope_items'
      );
    }

    if (this.customerRepository) {
      const cust = await this.customerRepository.findById(payload.customer_id);
      if (!cust) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy khách hàng', 'customer_id');
      }
    }

    const canSetFinancialAllocation = [
      ROLES.ADMIN,
      ROLES.BOD,
      ROLES.AM,
      ROLES.ACCOUNTANT,
    ].includes(actorRole);

    const fixedCostAllocation = canSetFinancialAllocation
      ? Math.max(0, Number(payload.fixed_cost_allocation || 0))
      : 0;
    const salesCommissionAmount = canSetFinancialAllocation
      ? Math.max(0, Number(payload.sales_commission_amount || 0))
      : 0;
    const riskReservePercent = canSetFinancialAllocation
      ? Math.min(100, Math.max(0, Number(payload.risk_reserve_percent ?? 25)))
      : 25;

    const tax = computeTaxBreakdownFromItems(payload.scope_items, payload.vat_rate_percent);
    const totalScopeLimit = payload.scope_items.reduce(
      (sum, item) => sum + Number(item.limit_mandays || 0),
      0
    );
    const baseCredit = computeContractCredit({
      baseContractValue: tax.grandTotalWithTax,
      fixedCostAllocation,
      salesCommissionAmount,
      riskReservePercent,
      standardMandayRate: payload.standard_manday_rate || 2500000,
    });
    // Nếu caller không truyền cứng đơn giá MD mà có tổng Limit > 0 -> tự chia đơn giá động = floor(Credit Y / Tổng Limit)
    const effectiveMandayRate =
      payload.standard_manday_rate !== undefined && payload.standard_manday_rate !== null
        ? Number(payload.standard_manday_rate)
        : totalScopeLimit > 0 && baseCredit.creditY > 0
          ? Math.max(100000, Math.floor(baseCredit.creditY / totalScopeLimit))
          : 2500000;
    const credit = computeContractCredit({
      baseContractValue: tax.grandTotalWithTax,
      fixedCostAllocation,
      salesCommissionAmount,
      riskReservePercent,
      standardMandayRate: effectiveMandayRate,
    });

    const limitValidation = validateScopeLimits(payload.scope_items, credit.initialMaxMandays);
    if (!limitValidation.valid) {
      throw new ApiError(HttpStatus.BAD_REQUEST, limitValidation.message, limitValidation.field);
    }

    const amTargetMandays = payload.scope_items.reduce(
      (sum, item) => sum + Number(item.target_mandays || 0),
      0
    );

    const preparedInstallments = (payload.installments || []).map((inst, idx) => {
      const vatParts = computeInstallmentVatParts({
        percentage: inst.percentage,
        taxBreakdown: tax,
      });
      return {
        ...inst,
        code: inst.code || `DOT-${idx + 1}`,
        ...vatParts,
      };
    });

    const totalHandoverEstimateMd = payload.scope_items.reduce(
      (sum, item) => sum + Number(item.handover_estimated_mandays || 0),
      0
    );
    const hasDriveUrl = Boolean(String(payload.drive_root_url || '').trim());
    const hasTimeline = Boolean(payload.start_date && payload.end_date);
    const incomingChecklist = payload.kickoff_checklist || {};
    const autoKickoffChecklist = {
      driveRootCreated: incomingChecklist.driveRootCreated ?? hasDriveUrl,
      driveTeamDocCreated: incomingChecklist.driveTeamDocCreated ?? hasDriveUrl,
      driveSharedDocCreated: incomingChecklist.driveSharedDocCreated ?? hasDriveUrl,
      drivePermissionsGranted: incomingChecklist.drivePermissionsGranted ?? hasDriveUrl,
      pmConfirmedScope:
        incomingChecklist.pmConfirmedScope ?? payload.scope_items.length > 0,
      kickoffTimelineConfirmed:
        incomingChecklist.kickoffTimelineConfirmed ?? hasTimeline,
      kickoffDate: incomingChecklist.kickoffDate || payload.start_date,
      handoverEstimateConfirmed:
        incomingChecklist.handoverEstimateConfirmed ?? totalHandoverEstimateMd > 0,
      handoverEstimateMandays:
        Number(incomingChecklist.handoverEstimateMandays || 0) ||
        totalHandoverEstimateMd,
    };

    const contractData = {
      code: payload.code,
      name: String(payload.name).trim(),
      customer_id: payload.customer_id,
      owner_am_id: payload.owner_am_id || actorId,
      owner_pm_id: payload.owner_pm_id || null,
      signed_date: payload.signed_date || payload.start_date,
      start_date: payload.start_date,
      end_date: payload.end_date,
      check_cycle_days: Number(payload.check_cycle_days || 7),
      base_contract_value: tax.grandTotalWithTax,
      fixed_cost_allocation: fixedCostAllocation,
      sales_commission_amount: salesCommissionAmount,
      risk_reserve_percent: riskReservePercent,
      standard_manday_rate: effectiveMandayRate,
      credit_y: credit.creditY,
      compression_ratio: Number(payload.compression_ratio || 1),
      initial_max_mandays: credit.initialMaxMandays,
      am_target_mandays: amTargetMandays,
      has_vat_items: tax.hasVatItems,
      has_non_vat_items: tax.hasNonVatItems,
      vat_rate_percent: tax.dominantVatRatePercent,
      vat_portion_amount: tax.vatTaxableBaseTotal + tax.vatTaxTotal,
      non_vat_portion_amount: tax.nonVatTotal,
      invoice_method: payload.invoice_method || 'BY_INSTALLMENT',
      external_accountant_note: payload.external_accountant_note || null,
      drive_root_url: payload.drive_root_url || null,
      kickoff_checklist: autoKickoffChecklist,
    };

    const created = await this.contractRepository.createWithPlanTransaction({
      contractData,
      scopeItems: payload.scope_items,
      installments: preparedInstallments,
      actorId,
    });

    return stripFinancialFieldsForRole(created, actorRole);
  }
}

module.exports = CreateContract;
