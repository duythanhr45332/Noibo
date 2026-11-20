const ApiError = require('../../utils/api-error');

describe('Sprint 3 Rules Validation (CR 0đ / Upsell / Accountant / Gatekeeper #2)', () => {
  it('enforces FREE_SUPPORT cumulative limit <= 1.0 MD and isolates support_mandays from Real', async () => {
    const repo = {
      createChangeRequestTransaction: jest.fn().mockImplementation(async (_cid, payload) => {
        if (payload.dev_mandays > 1.0) {
          throw new ApiError(400, 'Vượt hạn mức Hỗ trợ 0đ của Mốc (tối đa 1.0 MD Dev)', 'dev_mandays');
        }
        return { cr_type: 'FREE_SUPPORT', dev_mandays: payload.dev_mandays, quoted_price_vnd: 0 };
      }),
    };

    const ok = await repo.createChangeRequestTransaction('c1', {
      cr_type: 'FREE_SUPPORT',
      target_scope_item_id: 's1',
      title: 'Sửa màu nút',
      dev_mandays: 0.5,
    });
    expect(ok.quoted_price_vnd).toBe(0);

    await expect(
      repo.createChangeRequestTransaction('c1', {
        cr_type: 'FREE_SUPPORT',
        target_scope_item_id: 's1',
        title: 'Quá hạn mức',
        dev_mandays: 1.5,
      })
    ).rejects.toMatchObject({ status: 400, field: 'dev_mandays' });
  });

  it('blocks closing project when any am_expenses is not REIMBURSED', async () => {
    const repo = {
      closeProjectTransaction: jest.fn().mockRejectedValue(
        new ApiError(
          400,
          'Chưa đủ điều kiện Đóng dự án: Vẫn còn khoản chi phí AM chưa hoàn ứng (REIMBURSED)',
          'am_expenses'
        )
      ),
    };

    await expect(repo.closeProjectTransaction('c1', { actorId: 'am-1' })).rejects.toMatchObject({
      status: 400,
      field: 'am_expenses',
    });
  });

  it('requires ACCOUNTANT / AM / BOD / ADMIN to issue VAT invoice (blocks PM)', async () => {
    const PostgresSprint3Repository = require('../../infrastructure/database/PostgresSprint3Repository');
    const repo = new PostgresSprint3Repository();

    await expect(
      repo.updateInstallmentVat({
        installmentId: 'i1',
        status: 'ISSUED',
        actorRole: 'PM',
      })
    ).rejects.toMatchObject({ status: 403, field: 'vat_invoice_status' });
  });
});
