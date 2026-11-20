const {
  computeTaxBreakdownFromItems,
  computeContractCredit,
  computeInstallmentVatParts,
  validateScopeLimits,
  stripFinancialFieldsForRole,
} = require('./contract-finance.service');

describe('contract-finance.service', () => {
  it('computes 3-part VAT breakdown and grand total correctly', () => {
    const breakdown = computeTaxBreakdownFromItems([
      { amount_before_vat: 200_000_000, vat_category: 'NON_VAT' },
      { amount_before_vat: 100_000_000, vat_category: 'VAT_10' },
      { amount_before_vat: 50_000_000, vat_category: 'VAT_8' },
    ]);

    expect(breakdown.nonVatTotal).toBe(200_000_000);
    expect(breakdown.vatTaxableBaseTotal).toBe(150_000_000);
    expect(breakdown.vatTaxTotal).toBe(14_000_000); // 10M + 4M
    expect(breakdown.grandTotalWithTax).toBe(364_000_000);
  });

  it('computes Credit Y and initialMaxMandays accurately', () => {
    const credit = computeContractCredit({
      baseContractValue: 500_000_000,
      fixedCostAllocation: 65_000_000,
      salesCommissionAmount: 25_000_000,
      riskReservePercent: 20, // 100_000_000
      standardMandayRate: 2_500_000,
    });

    expect(credit.riskReserveAmount).toBe(100_000_000);
    expect(credit.creditY).toBe(310_000_000);
    expect(credit.initialMaxMandays).toBe(124);
  });

  it('splits installment into 3 BIGINT VAT parts consistently', () => {
    const breakdown = computeTaxBreakdownFromItems([
      { amount_before_vat: 200_000_000, vat_category: 'NON_VAT' },
      { amount_before_vat: 100_000_000, vat_category: 'VAT_10' },
    ]);
    const part = computeInstallmentVatParts({ percentage: 40, taxBreakdown: breakdown });

    expect(part.non_vat_base_amount).toBe(80_000_000);
    expect(part.vat_taxable_base_amount).toBe(40_000_000);
    expect(part.vat_tax_amount).toBe(4_000_000);
    expect(part.amount_total).toBe(124_000_000);
  });

  it('rejects scope limits exceeding contract max mandays or target > limit', () => {
    const overLimit = validateScopeLimits(
      [
        { title: 'M1', limit_mandays: 60, target_mandays: 50 },
        { title: 'M2', limit_mandays: 50, target_mandays: 40 },
      ],
      100
    );
    expect(overLimit.valid).toBe(false);

    const badTarget = validateScopeLimits(
      [{ title: 'M1', limit_mandays: 40, target_mandays: 45 }],
      100
    );
    expect(badTarget.valid).toBe(false);
  });

  it('strips VNĐ fields for PM and hides BOD cost structure for AM', () => {
    const sample = {
      contract_id: 'ct-1',
      base_contract_value: 500_000_000,
      fixed_cost_allocation: 65_000_000,
      sales_commission_amount: 25_000_000,
      risk_reserve_percent: 20,
      initial_max_mandays: 120,
      scope_items: [{ scope_item_id: 's1', amount_before_vat: 200_000_000, limit_mandays: 50 }],
      installments: [{ installment_id: 'i1', amount_total: 100_000_000, non_vat_base_amount: 100_000_000 }],
    };

    const forAm = stripFinancialFieldsForRole(sample, 'AM');
    expect(forAm.base_contract_value).toBe(500_000_000);
    expect(forAm.fixed_cost_allocation).toBeNull();
    expect(forAm.sales_commission_amount).toBeNull();

    const forPm = stripFinancialFieldsForRole(sample, 'PM');
    expect(forPm.base_contract_value).toBeNull();
    expect(forPm.initial_max_mandays).toBe(120);
    expect(forPm.scope_items[0].amount_before_vat).toBeNull();
    expect(forPm.scope_items[0].limit_mandays).toBe(50);
    expect(forPm.installments[0].amount_total).toBeNull();
  });
});
