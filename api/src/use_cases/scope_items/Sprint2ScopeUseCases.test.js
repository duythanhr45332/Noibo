const UpdateScopeItem = require('./UpdateScopeItem');
const KickoffContract = require('../contracts/KickoffContract');
const FinishMilestone = require('./FinishMilestone');
const ReopenMilestone = require('./ReopenMilestone');
const DisburseMilestoneBonus = require('./DisburseMilestoneBonus');

describe('Sprint 2 Scope & Gatekeeper #1 Use Cases', () => {
  it('UpdateScopeItem blocks PM from updating limit_mandays or target_mandays (403)', async () => {
    const scopeItemRepository = {
      findByIdWithContract: jest.fn().mockResolvedValue({
        scope_item_id: 's1',
        contract_id: 'c1',
        contract_phase: 'IN_PROJECT',
        limit_mandays: 40,
        target_mandays: 30,
      }),
    };
    const uc = new UpdateScopeItem({ scopeItemRepository });

    await expect(
      uc.execute('s1', { limit_mandays: 50 }, { actorId: 'pm-1', actorRole: 'PM' })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('UpdateScopeItem blocks AM from updating limit_mandays (403) and blocks Target > Limit (400)', async () => {
    const scopeItemRepository = {
      findByIdWithContract: jest.fn().mockResolvedValue({
        scope_item_id: 's1',
        contract_id: 'c1',
        contract_phase: 'PRE_PROJECT',
        limit_mandays: 40,
        target_mandays: 30,
      }),
    };
    const uc = new UpdateScopeItem({ scopeItemRepository });

    await expect(
      uc.execute('s1', { limit_mandays: 45 }, { actorId: 'am-1', actorRole: 'AM' })
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      uc.execute('s1', { target_mandays: 42 }, { actorId: 'am-1', actorRole: 'AM' })
    ).rejects.toMatchObject({ status: 400, field: 'target_mandays' });
  });

  it('KickoffContract, FinishMilestone, ReopenMilestone delegate cleanly to transactional repo', async () => {
    const scopeItemRepository = {
      kickoffContractTransaction: jest.fn().mockResolvedValue({ contract_id: 'c1', phase: 'IN_PROJECT' }),
      finishMilestoneTransaction: jest.fn().mockResolvedValue({
        scope_item_id: 's1',
        efficiency_status: 'AT_LIMIT',
        surplus_mandays: 0,
        bonus_payout_status: 'LOCKED',
      }),
      reopenMilestoneTransaction: jest.fn().mockResolvedValue({
        scope_item_id: 's1',
        bonus_payout_status: 'CLAWBACK_PENDING',
        contract_phase: 'IN_PROJECT',
      }),
    };

    const kick = await new KickoffContract({ scopeItemRepository }).execute('c1', { actorId: 'am-1' });
    expect(kick.phase).toBe('IN_PROJECT');

    const fin = await new FinishMilestone({ scopeItemRepository }).execute('s1', { note: 'OK', actorId: 'am-1' });
    expect(fin.efficiency_status).toBe('AT_LIMIT');

    const reop = await new ReopenMilestone({ scopeItemRepository }).execute('s1', { reason: 'Fix bug', actorId: 'am-1' });
    expect(reop.bonus_payout_status).toBe('CLAWBACK_PENDING');
    expect(reop.contract_phase).toBe('IN_PROJECT');
  });

  it('DisburseMilestoneBonus marks bonus DISBURSED via transactional repo', async () => {
    const scopeItemRepository = {
      disburseBonusTransaction: jest.fn().mockResolvedValue({
        scope_item_id: 's1',
        code: 'MỐC-01',
        bonus_payout_status: 'DISBURSED',
        bonus_mandays: 7.5,
        bonus_paid_amount: 18750000,
      }),
    };

    const disbursed = await new DisburseMilestoneBonus({ scopeItemRepository }).execute('s1', {
      note: 'UNC chuyển khoản thưởng Mốc 1',
      actorId: 'acc-1',
    });

    expect(disbursed.bonus_payout_status).toBe('DISBURSED');
    expect(disbursed.bonus_paid_amount).toBe(18750000);
    expect(scopeItemRepository.disburseBonusTransaction).toHaveBeenCalledWith('s1', {
      note: 'UNC chuyển khoản thưởng Mốc 1',
      actorId: 'acc-1',
    });
  });
});
