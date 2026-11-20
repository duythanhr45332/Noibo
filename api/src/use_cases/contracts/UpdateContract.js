const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const { ROLES } = require('../../domain/constants/roles');
const {
  computeTaxBreakdownFromItems,
  computeInstallmentVatParts,
  computeContractCredit,
  stripFinancialFieldsForRole,
} = require('../../domain/services/contract-finance.service');
const PostgresScopeItemRepository = require('../../infrastructure/database/PostgresScopeItemRepository');

const scopeItemRepoForAutoCheck = new PostgresScopeItemRepository();

const BOD_ONLY_FIELDS = [
  'fixed_cost_allocation',
  'sales_commission_amount',
  'risk_reserve_percent',
  'standard_manday_rate',
  'bod_allow_kickoff_without_advance',
];

class UpdateContract {
  constructor({ contractRepository, auditLogRepository, logger }) {
    this.contractRepository = contractRepository;
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async execute(contractId, payload, { actorId = null, actorRole = null } = {}) {
    const existing = await this.contractRepository.findByIdFull(contractId);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy hợp đồng', 'contractId');
    }

    if (existing.phase === 'CLOSED') {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'Hợp đồng đã Đóng sổ (CLOSED), không thể chỉnh sửa',
        'phase'
      );
    }

    const isBodOrAdmin = actorRole === ROLES.ADMIN || actorRole === ROLES.BOD;
    if (!isBodOrAdmin) {
      const attemptedBodFields = BOD_ONLY_FIELDS.filter((f) => payload[f] !== undefined);
      if (attemptedBodFields.length > 0) {
        throw new ApiError(
          HttpStatus.FORBIDDEN,
          `Chỉ Ban Giám Đốc / Admin mới có quyền chỉnh sửa trường: ${attemptedBodFields.join(', ')}`,
          attemptedBodFields[0]
        );
      }
    }

    if (payload.vat_rate_percent !== undefined && actorRole === ROLES.PM) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'Vai trò PM không có quyền chỉnh sửa thuế suất VAT của hợp đồng',
        'vat_rate_percent'
      );
    }

    const nextPatch = { ...payload };
    let effectiveBaseContractValue = Number(existing.base_contract_value || 0);
    let effectiveApprovedUpsellValue = Number(existing.approved_upsell_value || 0);
    let installmentVatUpdates = null;

    if (payload.vat_rate_percent !== undefined) {
      const nextVatRate = Math.min(100, Math.max(0, Number(payload.vat_rate_percent) || 0));
      const scopeList = Array.isArray(existing.scope_items) ? existing.scope_items : [];
      const approvedUpsells = Array.isArray(existing.change_requests)
        ? existing.change_requests.filter((cr) => cr.status === 'APPROVED_UPSELL')
        : [];
      const upsellPreTaxTotal = approvedUpsells.reduce(
        (sum, cr) => sum + Math.max(0, Number(cr.quoted_price_vnd || 0)),
        0
      );
      const totalScopePreTax = scopeList.reduce(
        (sum, s) => sum + Math.max(0, Number(s.amount_before_vat || 0)),
        0
      );
      // Trừ phần Upsell đã cộng vào scope_items để không bị cộng trùng giữa base_contract_value & approved_upsell_value
      const baselinePreTax = Math.max(0, totalScopePreTax - upsellPreTaxTotal);

      const baselineTax = computeTaxBreakdownFromItems(
        [{ amount_before_vat: baselinePreTax, vat_category: 'NON_VAT' }],
        nextVatRate
      );
      effectiveBaseContractValue = baselineTax.grandTotalWithTax;

      const upsellTax = computeTaxBreakdownFromItems(
        [{ amount_before_vat: upsellPreTaxTotal, vat_category: 'NON_VAT' }],
        nextVatRate
      );
      if (approvedUpsells.length > 0) {
        effectiveApprovedUpsellValue = upsellTax.grandTotalWithTax;
        nextPatch.approved_upsell_value = upsellTax.grandTotalWithTax;
      }

      nextPatch.base_contract_value = baselineTax.grandTotalWithTax;
      nextPatch.vat_rate_percent = nextVatRate;
      nextPatch.has_vat_items = baselineTax.hasVatItems;
      nextPatch.has_non_vat_items = baselineTax.hasNonVatItems;
      nextPatch.vat_portion_amount =
        baselineTax.vatTaxableBaseTotal + baselineTax.vatTaxTotal;
      nextPatch.non_vat_portion_amount = baselineTax.nonVatTotal;

      const existingInsts = Array.isArray(existing.installments) ? existing.installments : [];
      const approvedCrById = new Map(
        approvedUpsells.map((cr) => [cr.change_request_id, cr])
      );
      installmentVatUpdates = [];

      for (const inst of existingInsts) {
        if (!inst.source_cr_id && Number(inst.percentage || 0) > 0) {
          const parts = computeInstallmentVatParts({
            percentage: Number(inst.percentage || 0),
            taxBreakdown: baselineTax,
          });
          installmentVatUpdates.push({
            installment_id: inst.installment_id,
            ...parts,
            vat_invoice_status:
              inst.vat_invoice_status === 'ISSUED'
                ? 'ISSUED'
                : parts.vat_taxable_base_amount > 0
                  ? inst.vat_invoice_status === 'SENT_TO_ACCOUNTANT'
                    ? 'SENT_TO_ACCOUNTANT'
                    : 'NOT_YET'
                  : 'NOT_REQUIRED',
          });
        } else if (inst.source_cr_id && approvedCrById.has(inst.source_cr_id)) {
          const crItem = approvedCrById.get(inst.source_cr_id);
          const crTax = computeTaxBreakdownFromItems(
            [{ amount_before_vat: Number(crItem.quoted_price_vnd || 0), vat_category: 'NON_VAT' }],
            nextVatRate
          );
          const parts = computeInstallmentVatParts({
            percentage: 100,
            taxBreakdown: crTax,
          });
          installmentVatUpdates.push({
            installment_id: inst.installment_id,
            ...parts,
            vat_invoice_status:
              inst.vat_invoice_status === 'ISSUED'
                ? 'ISSUED'
                : parts.vat_taxable_base_amount > 0
                  ? inst.vat_invoice_status === 'SENT_TO_ACCOUNTANT'
                    ? 'SENT_TO_ACCOUNTANT'
                    : 'NOT_YET'
                  : 'NOT_REQUIRED',
          });
        }
      }
    }

    if (
      payload.vat_rate_percent !== undefined ||
      payload.fixed_cost_allocation !== undefined ||
      payload.sales_commission_amount !== undefined ||
      payload.risk_reserve_percent !== undefined ||
      payload.standard_manday_rate !== undefined
    ) {
      const credit = computeContractCredit({
        baseContractValue: effectiveBaseContractValue + effectiveApprovedUpsellValue,
        fixedCostAllocation:
          payload.fixed_cost_allocation ?? existing.fixed_cost_allocation,
        salesCommissionAmount:
          payload.sales_commission_amount ?? existing.sales_commission_amount,
        riskReservePercent:
          payload.risk_reserve_percent ?? existing.risk_reserve_percent,
        standardMandayRate:
          payload.standard_manday_rate ?? existing.standard_manday_rate,
      });
      const existingTotalLimit = Array.isArray(existing.scope_items)
        ? existing.scope_items.reduce((sum, s) => sum + Number(s.limit_mandays || 0), 0)
        : Number(existing.initial_max_mandays || 0);

      // Đơn giá 1 MD không cố định: nếu đổi chi phí/quỹ rủi ro mà không ghi đè đơn giá tay -> tính động = floor(Credit Y / Tổng Limit)
      const effectiveRate =
        payload.standard_manday_rate !== undefined
          ? Number(payload.standard_manday_rate)
          : existingTotalLimit > 0 && credit.creditY > 0
            ? Math.max(100000, Math.floor(credit.creditY / existingTotalLimit))
            : existing.standard_manday_rate;

      nextPatch.am_allocation_vnd = credit.creditY;
      nextPatch.standard_manday_rate = effectiveRate;
      nextPatch.initial_max_mandays =
        payload.standard_manday_rate !== undefined
          ? credit.initialMaxMandays
          : existingTotalLimit > 0
            ? Math.round(existingTotalLimit)
            : credit.initialMaxMandays;
    }

    if (installmentVatUpdates) {
      nextPatch._installment_vat_updates = installmentVatUpdates;
    }

    let updated = await this.contractRepository.updateBasicConfig(contractId, nextPatch);

    // Tự động kiểm tra giai đoạn PRE_PROJECT: nếu vừa cập nhật Drive / Checklist / BOD ngoại lệ và đã đạt đủ điều kiện -> tự động Kick-off sang IN_PROJECT
    if (
      existing.phase === 'PRE_PROJECT' &&
      (payload.bod_allow_kickoff_without_advance !== undefined ||
        payload.kickoff_checklist !== undefined ||
        payload.drive_root_url !== undefined ||
        payload.drive_permissions_verified !== undefined)
    ) {
      try {
        const autoRes = await scopeItemRepoForAutoCheck.tryAutoKickoff(
          contractId,
          actorId
        );
        if (autoRes?.autoKickedOff) {
          updated = await this.contractRepository.findByIdFull(contractId);
        }
      } catch (err) {
        if (this.logger) this.logger.warn('AutoKickoff check after UpdateContract failed:', err);
      }
    }

    if (this.auditLogRepository) {
      try {
        const { _installment_vat_updates: _ignored, ...auditNewValues } = nextPatch;
        await this.auditLogRepository.create({
          entity_name: 'contracts',
          entity_id: contractId,
          action: 'UPDATE_CONTRACT',
          old_values: {
            vat_rate_percent: existing.vat_rate_percent,
            base_contract_value: existing.base_contract_value,
            fixed_cost_allocation: existing.fixed_cost_allocation,
            sales_commission_amount: existing.sales_commission_amount,
            risk_reserve_percent: existing.risk_reserve_percent,
            standard_manday_rate: existing.standard_manday_rate,
            bod_allow_kickoff_without_advance: existing.bod_allow_kickoff_without_advance,
          },
          new_values: auditNewValues,
          changed_by: actorId,
        });
      } catch (err) {
        if (this.logger) this.logger.warn('AuditLog UpdateContract failed:', err);
      }
    }

    return stripFinancialFieldsForRole(updated, actorRole);
  }
}

module.exports = UpdateContract;
