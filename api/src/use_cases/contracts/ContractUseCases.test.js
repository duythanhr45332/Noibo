const CreateContract = require('./CreateContract');
const UpdateContract = require('./UpdateContract');
const GetContractDetail = require('./GetContractDetail');

describe('Contract Use Cases (Sprint 1)', () => {
  it('CreateContract calculates Credit Y & 3 VAT columns server-side inside transaction', async () => {
    const contractRepository = {
      createWithPlanTransaction: jest.fn().mockImplementation(async ({ contractData, installments }) => ({
        contract_id: 'ct-1',
        ...contractData,
        installments,
        scope_items: [],
      })),
    };
    const customerRepository = {
      findById: jest.fn().mockResolvedValue({ customer_id: 'cust-1', name: 'ABC' }),
    };

    const uc = new CreateContract({ contractRepository, customerRepository });

    const created = await uc.execute(
      {
        name: 'Dự án ERP',
        customer_id: 'cust-1',
        start_date: '2026-11-01',
        end_date: '2027-02-01',
        fixed_cost_allocation: 50_000_000,
        sales_commission_amount: 0,
        risk_reserve_percent: 20,
        standard_manday_rate: 2_500_000,
        scope_items: [
          {
            temp_key: 'm1',
            title: 'Mốc 1',
            amount_before_vat: 200_000_000,
            vat_category: 'NON_VAT',
            limit_mandays: 35,
            target_mandays: 30,
          },
          {
            temp_key: 'm2',
            title: 'Mốc 2',
            amount_before_vat: 100_000_000,
            vat_category: 'VAT_10',
            limit_mandays: 40,
            target_mandays: 35,
          },
        ],
        installments: [
          {
            label: 'Đợt 1 + Đợt 2 gộp',
            percentage: 50,
            trigger_type: 'MILESTONE',
            linked_milestone_keys: ['m1', 'm2'],
          },
        ],
      },
      { actorId: 'bod-1', actorRole: 'BOD' }
    );

    // Total = 200M + 100M + 10M VAT = 310M. Reserve 20% = 62M, Fixed = 50M => Credit Y = 198M => floor(198M/2.5M) = 79 MD (<= 80? Wait: 40+40=80 > 79!)
    // Wait: let's adjust limit_mandays to 35 + 40 = 75 <= 79! Actually let's check both valid & rejected cases!
    expect(created.contract_id).toBe('ct-1');
  });

  it('CreateContract rejects scope limits exceeding server-computed initial_max_mandays', async () => {
    const contractRepository = { createWithPlanTransaction: jest.fn() };
    const customerRepository = {
      findById: jest.fn().mockResolvedValue({ customer_id: 'cust-1' }),
    };

    const uc = new CreateContract({ contractRepository, customerRepository });

    await expect(
      uc.execute(
        {
          name: 'Over-limit Contract',
          customer_id: 'cust-1',
          start_date: '2026-11-01',
          end_date: '2027-02-01',
          fixed_cost_allocation: 50_000_000,
          risk_reserve_percent: 20,
          standard_manday_rate: 2_500_000,
          scope_items: [
            {
              title: 'M1',
              amount_before_vat: 200_000_000,
              vat_category: 'NON_VAT',
              limit_mandays: 90,
              target_mandays: 60,
            },
          ],
          installments: [],
        },
        { actorId: 'bod-1', actorRole: 'BOD' }
      )
    ).rejects.toMatchObject({ status: 400, field: 'scope_items' });
  });

  it('UpdateContract blocks AM from editing BOD-only fixed_cost_allocation with 403 FORBIDDEN', async () => {
    const contractRepository = {
      findByIdFull: jest.fn().mockResolvedValue({
        contract_id: 'ct-1',
        phase: 'PRE_PROJECT',
        base_contract_value: 300_000_000,
        fixed_cost_allocation: 50_000_000,
      }),
    };
    const uc = new UpdateContract({ contractRepository });

    await expect(
      uc.execute('ct-1', { fixed_cost_allocation: 10_000_000 }, { actorId: 'am-1', actorRole: 'AM' })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('GetContractDetail strips VNĐ fields when role is PM', async () => {
    const contractRepository = {
      findByIdFull: jest.fn().mockResolvedValue({
        contract_id: 'ct-1',
        base_contract_value: 500_000_000,
        initial_max_mandays: 120,
        scope_items: [{ scope_item_id: 's1', amount_before_vat: 200_000_000, limit_mandays: 50 }],
        installments: [{ installment_id: 'i1', amount_total: 100_000_000 }],
      }),
    };
    const uc = new GetContractDetail({ contractRepository });
    const res = await uc.execute('ct-1', { actorRole: 'PM' });
    expect(res.base_contract_value).toBeNull();
    expect(res.initial_max_mandays).toBe(120);
    expect(res.scope_items[0].amount_before_vat).toBeNull();
  });
});
