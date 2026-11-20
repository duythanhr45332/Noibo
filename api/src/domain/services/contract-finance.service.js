const { ROLES } = require('../constants/roles');

/**
 * Tính phân tách VAT từ danh sách Scope Items.
 * Nếu truyền contractVatRatePercent (0..100), áp dụng thuế suất cấp hợp đồng lên toàn bộ giá trị trước thuế;
 * nếu không truyền, tự cộng theo từng vat_category của từng Mốc (NON_VAT / VAT_8 / VAT_10).
 */
function computeTaxBreakdownFromItems(scopeItems = [], contractVatRatePercent = undefined) {
  if (contractVatRatePercent !== undefined && contractVatRatePercent !== null) {
    const rate = Math.min(100, Math.max(0, Number(contractVatRatePercent) || 0));
    const totalBeforeVat = scopeItems.reduce(
      (sum, item) => sum + Math.max(0, Math.round(Number(item.amount_before_vat || 0))),
      0
    );
    if (rate === 0) {
      return {
        nonVatTotal: totalBeforeVat,
        vat8Base: 0,
        vat8Tax: 0,
        vat10Base: 0,
        vat10Tax: 0,
        vatTaxableBaseTotal: 0,
        vatTaxTotal: 0,
        grandTotalWithTax: totalBeforeVat,
        hasVatItems: false,
        hasNonVatItems: totalBeforeVat > 0,
        dominantVatRatePercent: 0,
      };
    }
    const vatTaxTotal = Math.round((totalBeforeVat * rate) / 100);
    return {
      nonVatTotal: 0,
      vat8Base: rate === 8 ? totalBeforeVat : 0,
      vat8Tax: rate === 8 ? vatTaxTotal : 0,
      vat10Base: rate === 10 ? totalBeforeVat : 0,
      vat10Tax: rate === 10 ? vatTaxTotal : 0,
      vatTaxableBaseTotal: totalBeforeVat,
      vatTaxTotal,
      grandTotalWithTax: totalBeforeVat + vatTaxTotal,
      hasVatItems: totalBeforeVat > 0,
      hasNonVatItems: false,
      dominantVatRatePercent: rate,
    };
  }

  let nonVatTotal = 0;
  let vat8Base = 0;
  let vat10Base = 0;

  for (const item of scopeItems) {
    const amount = Math.max(0, Math.round(Number(item.amount_before_vat || 0)));
    const cat = item.vat_category || 'NON_VAT';
    if (cat === 'VAT_8') {
      vat8Base += amount;
    } else if (cat === 'VAT_10') {
      vat10Base += amount;
    } else {
      nonVatTotal += amount;
    }
  }

  const vat8Tax = Math.round(vat8Base * 0.08);
  const vat10Tax = Math.round(vat10Base * 0.1);
  const vatTaxableBaseTotal = vat8Base + vat10Base;
  const vatTaxTotal = vat8Tax + vat10Tax;
  const grandTotalWithTax = nonVatTotal + vatTaxableBaseTotal + vatTaxTotal;

  return {
    nonVatTotal,
    vat8Base,
    vat8Tax,
    vat10Base,
    vat10Tax,
    vatTaxableBaseTotal,
    vatTaxTotal,
    grandTotalWithTax,
    hasVatItems: vatTaxableBaseTotal > 0,
    hasNonVatItems: nonVatTotal > 0,
    dominantVatRatePercent:
      vatTaxableBaseTotal === 0 ? 0 : vat8Base > 0 && vat10Base === 0 ? 8 : 10,
  };
}

/**
 * Công thức Credit Y & Trần Mandays:
 * Credit Y = Tổng giá trị HĐ - (Chi phí cố định + Hoa hồng Sales + Quỹ rủi ro)
 * initialMaxMandays = floor(Credit Y / Đơn giá chuẩn)
 */
function computeContractCredit({
  baseContractValue,
  fixedCostAllocation = 0,
  salesCommissionAmount = 0,
  riskReservePercent = 0,
  standardMandayRate = 2500000,
}) {
  const baseVal = Math.max(0, Math.round(Number(baseContractValue) || 0));
  const fixedCost = Math.max(0, Math.round(Number(fixedCostAllocation) || 0));
  const commission = Math.max(0, Math.round(Number(salesCommissionAmount) || 0));
  const riskPct = Math.min(100, Math.max(0, Number(riskReservePercent) || 0));
  const rate = Math.max(1, Math.round(Number(standardMandayRate) || 2500000));

  const riskReserveAmount = Math.round((baseVal * riskPct) / 100);
  const creditY = Math.max(0, baseVal - (fixedCost + commission + riskReserveAmount));
  const initialMaxMandays = Math.floor(creditY / rate);

  return {
    baseContractValue: baseVal,
    riskReserveAmount,
    creditY,
    initialMaxMandays,
  };
}

/**
 * Tách 3 cột tiền VAT BIGINT cho một Đợt thanh toán dựa trên tỷ lệ %
 */
function computeInstallmentVatParts({ percentage = 0, taxBreakdown }) {
  const pct = Math.min(100, Math.max(0, Number(percentage) || 0));
  const nonVatBase = Math.round(((taxBreakdown.nonVatTotal || 0) * pct) / 100);
  const vatTaxableBase = Math.round(((taxBreakdown.vatTaxableBaseTotal || 0) * pct) / 100);
  const vatTaxAmount = Math.round(((taxBreakdown.vatTaxTotal || 0) * pct) / 100);
  const amountTotal = nonVatBase + vatTaxableBase + vatTaxAmount;

  let vatRateHint = 'NON_VAT';
  if (vatTaxableBase > 0 && nonVatBase > 0) {
    vatRateHint = 'MIXED';
  } else if (vatTaxableBase > 0) {
    const r = Number(taxBreakdown.dominantVatRatePercent || 10);
    vatRateHint = r === 8 ? 'VAT_8' : r === 10 ? 'VAT_10' : `VAT_${r}`;
  }

  return {
    percentage: pct,
    non_vat_base_amount: nonVatBase,
    vat_taxable_base_amount: vatTaxableBase,
    vat_tax_amount: vatTaxAmount,
    amount_total: amountTotal,
    vat_rate_hint: vatRateHint,
  };
}

/**
 * Kiểm tra tổng Limit các Mốc không vượt quá trần Limit hợp đồng
 * và Target của từng Mốc <= Limit của Mốc đó
 */
function validateScopeLimits(scopeItems = [], allowedMaxMandays = 0) {
  let sumLimits = 0;
  for (let idx = 0; idx < scopeItems.length; idx += 1) {
    const item = scopeItems[idx];
    const limitMd = Number(item.limit_mandays || 0);
    const targetMd = Number(item.target_mandays || 0);

    if (limitMd < 0 || targetMd < 0) {
      return {
        valid: false,
        field: `scope_items.${idx}`,
        message: 'Limit và Target Mandays không được âm',
      };
    }

    if (targetMd > limitMd) {
      return {
        valid: false,
        field: `scope_items.${idx}.target_mandays`,
        message: `Target (${targetMd} MD) tại "${item.title || item.code}" không được vượt quá Limit (${limitMd} MD)`,
      };
    }

    sumLimits += limitMd;
  }

  if (Math.round(sumLimits * 100) / 100 > Math.round(Number(allowedMaxMandays) * 100) / 100) {
    return {
      valid: false,
      field: 'scope_items',
      message: `Tổng Limit các Mốc (${sumLimits} MD) vượt quá trần Credit cho phép (${allowedMaxMandays} MD)`,
    };
  }

  return { valid: true, sumLimits };
}

/**
 * JSON Response Stripping theo RBAC:
 * - PM: xóa trắng toàn bộ trường VNĐ ở contract, scope_items, installments, change_requests, am_expenses
 * - Khác BOD/ADMIN: ẩn cấu trúc chi phí nội bộ (fixed_cost_allocation, sales_commission_amount, risk_reserve_percent)
 */
function stripFinancialFieldsForRole(contract, role) {
  if (!contract) return contract;
  const clone = { ...contract };

  if (role !== ROLES.ADMIN && role !== ROLES.BOD) {
    clone.fixed_cost_allocation = null;
    clone.sales_commission_amount = null;
    clone.risk_reserve_percent = null;
    clone.risk_reserve_amount = null;
  }

  if (role === ROLES.PM) {
    clone.base_contract_value = null;
    clone.approved_upsell_value = null;
    clone.am_allocation_vnd = null;
    clone.standard_manday_rate = null;
    clone.internal_unit_price = null;
    clone.credit_y = null;
    clone.vat_portion_amount = null;
    clone.non_vat_portion_amount = null;
    clone.am_advance_amount = null;

    if (Array.isArray(clone.scope_items)) {
      clone.scope_items = clone.scope_items.map((s) => ({
        ...s,
        amount_before_vat: null,
        bonus_paid_amount: null,
      }));
    }

    if (Array.isArray(clone.installments)) {
      clone.installments = clone.installments.map((i) => ({
        ...i,
        non_vat_base_amount: null,
        vat_taxable_base_amount: null,
        vat_tax_amount: null,
        amount_total: null,
      }));
    }

    if (Array.isArray(clone.change_requests)) {
      clone.change_requests = clone.change_requests.map((cr) => ({
        ...cr,
        quoted_price_vnd: null,
      }));
    }

    if (Array.isArray(clone.am_expenses)) {
      clone.am_expenses = clone.am_expenses.map((exp) => ({
        ...exp,
        amount_vnd: null,
      }));
    }
  }

  return clone;
}

module.exports = {
  computeTaxBreakdownFromItems,
  computeContractCredit,
  computeInstallmentVatParts,
  validateScopeLimits,
  stripFinancialFieldsForRole,
};
