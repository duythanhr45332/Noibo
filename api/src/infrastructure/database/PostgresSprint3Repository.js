const db = require('../../config/database');
const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const PostgresScopeItemRepository = require('./PostgresScopeItemRepository');
const scopeItemRepoForAutoCheck = new PostgresScopeItemRepository();
const { computeTaxBreakdownFromItems, computeInstallmentVatParts } = require('../../domain/services/contract-finance.service');

class PostgresSprint3Repository {
  // ===========================================================================
  // 1. CHANGE REQUESTS (FREE_SUPPORT 1:1 <= 1 MD/mốc & UPSELL cộng thẳng Mốc)
  // ===========================================================================
  async createChangeRequestTransaction(contractId, payload, actorId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const cRes = await client.query(
        `SELECT * FROM contracts WHERE contract_id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [contractId]
      );
      if (cRes.rows.length === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy hợp đồng', 'contractId');
      }
      const contract = cRes.rows[0];
      if (contract.phase === 'PRE_PROJECT' || contract.phase === 'CLOSED') {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `Không thể tạo phát sinh khi dự án đang ở giai đoạn ${contract.phase}`,
          'phase'
        );
      }

      if (!payload.target_scope_item_id) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Vui lòng chọn Mốc bàn giao liên kết (target_scope_item_id)',
          'target_scope_item_id'
        );
      }

      const scopeRes = await client.query(
        `SELECT * FROM scope_items WHERE scope_item_id = $1 AND contract_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [payload.target_scope_item_id, contractId]
      );
      if (scopeRes.rows.length === 0) {
        throw new ApiError(
          HttpStatus.NOT_FOUND,
          'Không tìm thấy Mốc bàn giao liên kết trong hợp đồng',
          'target_scope_item_id'
        );
      }
      const scope = scopeRes.rows[0];

      const seqRes = await client.query("SELECT nextval('seq_cr_code')::int AS seq");
      const seqNum = String(seqRes.rows[0].seq).padStart(3, '0');
      const isFree = payload.cr_type === 'FREE_SUPPORT';
      const code = isFree ? `SUP-${seqNum}` : `CR-${seqNum}`;

      if (isFree) {
        const devMd = Number(payload.dev_mandays || 0);
        if (devMd <= 0) {
          throw new ApiError(HttpStatus.BAD_REQUEST, 'Số ngày công Dev phải > 0', 'dev_mandays');
        }

        const usedRes = await client.query(
          `
            SELECT COALESCE(SUM(dev_mandays), 0)::numeric(10,2) AS used_md
            FROM change_requests
            WHERE contract_id = $1
              AND target_scope_item_id = $2
              AND cr_type = 'FREE_SUPPORT'
              AND status <> 'REJECTED'
              AND deleted_at IS NULL
          `,
          [contractId, scope.scope_item_id]
        );
        const usedMd = Number(usedRes.rows[0]?.used_md || 0);
        if (Math.round((usedMd + devMd) * 100) / 100 > 1.0) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `Vượt hạn mức Hỗ trợ 0đ của Mốc ${scope.code}: đã dùng ${usedMd}/1.0 MD, không thể thêm +${devMd} MD`,
            'dev_mandays'
          );
        }

        // Quy tắc 1:1 -> cộng vào cột riêng support_mandays, KHÔNG đụng vào actual_mandays (Real)
        const nextSupportMd = Math.round((Number(scope.support_mandays || 0) + devMd) * 100) / 100;
        await client.query(
          `UPDATE scope_items SET support_mandays = $1, updated_at = NOW() WHERE scope_item_id = $2`,
          [nextSupportMd, scope.scope_item_id]
        );

        const crRes = await client.query(
          `
            INSERT INTO change_requests (
              contract_id, target_scope_item_id, code, cr_type, title, description,
              requested_by_client_contact, dev_mandays, pm_estimated_mandays,
              am_allocated_to_pm_mandays, quoted_price_vnd, vat_category, timeline_impact_days,
              status, am_negotiation_note, created_by, approved_by, approved_at
            )
            VALUES (
              $1, $2, $3, 'FREE_SUPPORT', $4, $5,
              $6, $7, $7,
              $7, 0, 'NON_VAT', $8,
              'APPROVED_FREE_GOODWILL', $9, $10, $10, NOW()
            )
            RETURNING *
          `,
          [
            contractId,
            scope.scope_item_id,
            code,
            payload.title,
            payload.description || '',
            payload.requested_by_client_contact || '',
            devMd,
            Number(payload.timeline_impact_days || 0),
            payload.am_negotiation_note || 'Hỗ trợ miễn phí 1:1 (ghi cột Hỗ trợ 0đ riêng)',
            actorId,
          ]
        );

        await client.query(
          `
            INSERT INTO scope_progress_logs (
              contract_id, scope_item_id, log_type, delta_mandays, cumulative_mandays,
              previous_actual_mandays, limit_mandays_snapshot, note, logged_by
            )
            VALUES ($1, $2, 'FREE_SUPPORT', $3, $4, $4, $5, $6, $7)
          `,
          [
            contractId,
            scope.scope_item_id,
            devMd,
            Number(scope.actual_mandays || 0),
            Number(scope.limit_mandays || 0),
            `[${code}] Hỗ trợ 0đ +${devMd} MD (tổng hỗ trợ Mốc: ${nextSupportMd} MD)`,
            actorId,
          ]
        );

        await client.query('COMMIT');
        return crRes.rows[0];
      }

      // UPSELL flow starts at PM_ESTIMATING (or AM_QUOTING if estimate provided)
      const pmEst = Number(payload.pm_estimated_mandays || 0);
      const initialStatus = pmEst > 0 ? 'AM_QUOTING' : 'PM_ESTIMATING';
      const crRes = await client.query(
        `
          INSERT INTO change_requests (
            contract_id, target_scope_item_id, code, cr_type, title, description,
            requested_by_client_contact, dev_mandays, pm_estimated_mandays,
            am_allocated_to_pm_mandays, quoted_price_vnd, vat_category, timeline_impact_days,
            status, am_negotiation_note, created_by
          )
          VALUES (
            $1, $2, $3, 'UPSELL', $4, $5,
            $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15
          )
          RETURNING *
        `,
        [
          contractId,
          scope.scope_item_id,
          code,
          payload.title,
          payload.description || '',
          payload.requested_by_client_contact || '',
          Number(payload.dev_mandays || pmEst),
          pmEst,
          Number(payload.am_allocated_to_pm_mandays || pmEst),
          Math.round(Number(payload.quoted_price_vnd || 0)),
          payload.vat_category || 'NON_VAT',
          Number(payload.timeline_impact_days || 0),
          initialStatus,
          payload.am_negotiation_note || '',
          actorId,
        ]
      );

      await client.query('COMMIT');
      return crRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resolveChangeRequestTransaction(crId, payload, actorId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const crRes = await client.query(
        `
          SELECT cr.*, c.phase AS contract_phase, c.standard_manday_rate, c.risk_reserve_percent, c.vat_rate_percent
          FROM change_requests cr
          INNER JOIN contracts c ON c.contract_id = cr.contract_id AND c.deleted_at IS NULL
          WHERE cr.change_request_id = $1 AND cr.deleted_at IS NULL
          FOR UPDATE OF cr
        `,
        [crId]
      );
      if (crRes.rows.length === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy Change Request', 'crId');
      }
      const cr = crRes.rows[0];

      if (cr.contract_phase === 'CLOSED') {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Dự án đã Đóng sổ (CLOSED)', 'phase');
      }
      if (cr.status === 'APPROVED_UPSELL' || cr.status === 'REJECTED') {
        throw new ApiError(HttpStatus.BAD_REQUEST, `CR đã ở trạng thái kết thúc (${cr.status})`, 'status');
      }

      const nextStatus = payload.status || cr.status;
      const nextPmEst =
        payload.pm_estimated_mandays !== undefined
          ? Number(payload.pm_estimated_mandays)
          : Number(cr.pm_estimated_mandays || 0);
      const nextAmAlloc =
        payload.am_allocated_to_pm_mandays !== undefined
          ? Number(payload.am_allocated_to_pm_mandays)
          : Number(cr.am_allocated_to_pm_mandays || nextPmEst);
      const nextQuoted =
        payload.quoted_price_vnd !== undefined
          ? Math.round(Number(payload.quoted_price_vnd))
          : Number(cr.quoted_price_vnd || 0);
      const nextVatCat = payload.vat_category || cr.vat_category || 'NON_VAT';

      if (nextStatus === 'APPROVED_UPSELL' || nextStatus === 'APPROVED_PAID') {
        if (nextQuoted <= 0 && cr.cr_type === 'UPSELL') {
          throw new ApiError(HttpStatus.BAD_REQUEST, 'Giá trị Upsell được duyệt phải > 0 VNĐ', 'quoted_price_vnd');
        }

        const scopeRes = await client.query(
          `SELECT * FROM scope_items WHERE scope_item_id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [cr.target_scope_item_id]
        );
        if (scopeRes.rows.length === 0) {
          throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy Mốc liên kết của CR', 'target_scope_item_id');
        }
        const scope = scopeRes.rows[0];

        // Tính Limit cộng thêm từ giá trị Upsell theo đúng % thuế VAT của hợp đồng
        const contractVatRate =
          cr.vat_rate_percent !== undefined && cr.vat_rate_percent !== null
            ? Number(cr.vat_rate_percent)
            : undefined;
        const taxBreakdown = computeTaxBreakdownFromItems(
          [{ amount_before_vat: nextQuoted, vat_category: nextVatCat }],
          contractVatRate
        );
        const rate = Math.max(1, Number(cr.standard_manday_rate || 2500000));
        const riskFactor = 1 - Math.min(100, Math.max(0, Number(cr.risk_reserve_percent || 0))) / 100;
        const creditUpsell = Math.round(taxBreakdown.grandTotalWithTax * riskFactor);
        const addedLimitMd = Math.max(nextAmAlloc, Math.floor(creditUpsell / rate));

        // Rule #6: Cộng thẳng vào Mốc đang chạy (mở lại nếu đã Finish)
        const wasAccepted = Boolean(scope.is_accepted);
        await client.query(
          `
            UPDATE scope_items
            SET
              limit_mandays = limit_mandays + $1,
              target_mandays = target_mandays + $2,
              estimated_mandays = estimated_mandays + $3,
              amount_before_vat = amount_before_vat + $4,
              is_accepted = false,
              execution_status = 'IN_PROGRESS',
              progress_percent = CASE WHEN $5 THEN 85 ELSE progress_percent END,
              updated_at = NOW()
            WHERE scope_item_id = $6
          `,
          [addedLimitMd, nextAmAlloc, nextPmEst, nextQuoted, wasAccepted, scope.scope_item_id]
        );

        await client.query(
          `
            UPDATE contracts
            SET
              approved_upsell_value = approved_upsell_value + $1,
              upsell_added_mandays = upsell_added_mandays + $2,
              phase = CASE WHEN phase = 'POST_PROJECT' THEN 'IN_PROJECT' ELSE phase END,
              updated_at = NOW()
            WHERE contract_id = $3
          `,
          [taxBreakdown.grandTotalWithTax, addedLimitMd, cr.contract_id]
        );

        // Sinh thêm Đợt thanh toán 3 cột VAT gắn với chính Mốc đó
        const maxSortRes = await client.query(
          `SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order FROM payment_installments WHERE contract_id = $1 AND deleted_at IS NULL`,
          [cr.contract_id]
        );
        const nextOrder = maxSortRes.rows[0]?.next_order || 1;
        const instParts = computeInstallmentVatParts({ percentage: 100, taxBreakdown });

        const instRes = await client.query(
          `
            INSERT INTO payment_installments (
              contract_id, code, label, trigger_type, sort_order, percentage,
              non_vat_base_amount, vat_taxable_base_amount, vat_tax_amount, amount_total,
              vat_rate_hint, payment_status, vat_invoice_status, source_cr_id
            )
            VALUES (
              $1, $2, $3, 'MILESTONE', $4, 0,
              $5, $6, $7, $8,
              $9, 'PENDING', $10, $11
            )
            RETURNING installment_id
          `,
          [
            cr.contract_id,
            `DOT-CR-${cr.code}`,
            `Phụ lục Upsell ${cr.code}: ${cr.title}`,
            nextOrder,
            instParts.non_vat_base_amount,
            instParts.vat_taxable_base_amount,
            instParts.vat_tax_amount,
            instParts.amount_total,
            instParts.vat_rate_hint,
            instParts.vat_taxable_base_amount > 0 ? 'NOT_YET' : 'NOT_REQUIRED',
            cr.change_request_id,
          ]
        );

        await client.query(
          `INSERT INTO installment_milestone_links (installment_id, scope_item_id) VALUES ($1, $2)`,
          [instRes.rows[0].installment_id, scope.scope_item_id]
        );

        await client.query(
          `
            INSERT INTO scope_progress_logs (
              contract_id, scope_item_id, log_type, delta_mandays, cumulative_mandays,
              previous_actual_mandays, limit_mandays_snapshot, note, logged_by
            )
            VALUES ($1, $2, 'UPSELL_ADDED', 0, $3, $3, $4, $5, $6)
          `,
          [
            cr.contract_id,
            scope.scope_item_id,
            Number(scope.actual_mandays || 0),
            Number(scope.limit_mandays || 0) + addedLimitMd,
            `Duyệt Upsell ${cr.code}: +${addedLimitMd} Limit / +${nextAmAlloc} Target / +${nextPmEst} Est`,
            actorId,
          ]
        );

        const updatedCr = await client.query(
          `
            UPDATE change_requests
            SET
              status = 'APPROVED_UPSELL',
              pm_estimated_mandays = $1,
              am_allocated_to_pm_mandays = $2,
              quoted_price_vnd = $3,
              vat_category = $4,
              am_negotiation_note = COALESCE($5, am_negotiation_note),
              approved_by = $6,
              approved_at = NOW(),
              updated_at = NOW()
            WHERE change_request_id = $7
            RETURNING *
          `,
          [
            nextPmEst,
            nextAmAlloc,
            nextQuoted,
            nextVatCat,
            payload.am_negotiation_note ?? null,
            actorId,
            crId,
          ]
        );

        await client.query('COMMIT');
        return updatedCr.rows[0];
      }

      const updatedCr = await client.query(
        `
          UPDATE change_requests
          SET
            status = $1,
            pm_estimated_mandays = $2,
            am_allocated_to_pm_mandays = $3,
            quoted_price_vnd = $4,
            vat_category = $5,
            am_negotiation_note = COALESCE($6, am_negotiation_note),
            updated_at = NOW()
          WHERE change_request_id = $7
          RETURNING *
        `,
        [
          nextStatus,
          nextPmEst,
          nextAmAlloc,
          nextQuoted,
          nextVatCat,
          payload.am_negotiation_note ?? null,
          crId,
        ]
      );

      await client.query('COMMIT');
      return updatedCr.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // 2. INSTALLMENTS (HÀNG ĐỢI KẾ TOÁN, VAT ISSUED, PAID + MỞ KHÓA THƯỞNG 50%)
  // ===========================================================================
  async listInstallmentQueue({ page = 1, limit = 20, statusFilter = '' } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions = ['i.deleted_at IS NULL', 'c.deleted_at IS NULL'];
    const params = [];

    if (statusFilter === 'VAT_QUEUE') {
      conditions.push(`i.vat_invoice_status = 'SENT_TO_ACCOUNTANT'`);
    } else if (statusFilter === 'OVERDUE') {
      conditions.push(`i.payment_status = 'OVERDUE'`);
    } else if (statusFilter === 'UNPAID') {
      conditions.push(`i.payment_status <> 'PAID'`);
    }

    const whereClause = conditions.join(' AND ');
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM payment_installments i
       INNER JOIN contracts c ON c.contract_id = i.contract_id
       WHERE ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const listParams = [...params, safeLimit, offset];
    const listRes = await db.query(
      `
        SELECT
          i.*,
          c.code AS contract_code,
          c.name AS contract_name,
          c.phase AS contract_phase,
          cust.name AS customer_name,
          cust.tax_code AS customer_tax_code,
          cust.accounting_contact_email
        FROM payment_installments i
        INNER JOIN contracts c ON c.contract_id = i.contract_id
        LEFT JOIN customers cust ON cust.customer_id = c.customer_id
        WHERE ${whereClause}
        ORDER BY i.due_date ASC NULLS LAST, i.sort_order ASC
        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
      `,
      listParams
    );

    return {
      items: listRes.rows.map((r) => ({
        ...r,
        percentage: Number(r.percentage || 0),
        non_vat_base_amount: Number(r.non_vat_base_amount || 0),
        vat_taxable_base_amount: Number(r.vat_taxable_base_amount || 0),
        vat_tax_amount: Number(r.vat_tax_amount || 0),
        amount_total: Number(r.amount_total || 0),
      })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  async updateInstallmentVat({ installmentId, status, vatInvoiceNumber, fileId, fileUrl, actorRole, actorId }) {
    if (status === 'ISSUED' && !['ADMIN', 'BOD', 'ACCOUNTANT', 'AM'].includes(actorRole)) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'Chỉ Kế toán / AM / BOD / Admin mới được xác nhận Đã xuất hóa đơn VAT (ISSUED)',
        'vat_invoice_status'
      );
    }

    const isIssued = status === 'ISSUED';
    const res = await db.query(
      `
        UPDATE payment_installments
        SET
          vat_invoice_status = $1::varchar,
          vat_invoice_number = COALESCE($2::varchar, vat_invoice_number),
          vat_invoice_file_id = COALESCE($3::uuid, vat_invoice_file_id),
          vat_invoice_file_url = COALESCE($4::text, vat_invoice_file_url),
          vat_issued_date = CASE WHEN $5::boolean THEN NOW() ELSE vat_issued_date END,
          updated_at = NOW()
        WHERE installment_id = $6::uuid AND deleted_at IS NULL
        RETURNING *
      `,
      [status, vatInvoiceNumber || null, fileId || null, fileUrl || null, isIssued, installmentId]
    );

    if (res.rows.length === 0) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy đợt thanh toán', 'installmentId');
    }

    if (actorId) {
      await db.query(
        `INSERT INTO audit_logs (entity_name, entity_id, action, new_values, changed_by)
         VALUES ('payment_installments', $1, 'UPDATE_INSTALLMENT_VAT', $2::jsonb, $3)`,
        [installmentId, JSON.stringify({ status, vat_invoice_number: vatInvoiceNumber }), actorId]
      );
    }

    return res.rows[0];
  }

  async markInstallmentPaidTransaction(installmentId, { paidDate = null, actorId = null } = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const instRes = await client.query(
        `SELECT * FROM payment_installments WHERE installment_id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [installmentId]
      );
      if (instRes.rows.length === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy đợt thanh toán', 'installmentId');
      }
      const inst = instRes.rows[0];

      // Check linked milestones if trigger_type !== 'ADVANCE'
      const linksRes = await client.query(
        `
          SELECT s.scope_item_id, s.code, s.is_accepted, s.limit_mandays, s.actual_mandays
          FROM installment_milestone_links l
          INNER JOIN scope_items s ON s.scope_item_id = l.scope_item_id AND s.deleted_at IS NULL
          WHERE l.installment_id = $1
        `,
        [installmentId]
      );

      if (inst.trigger_type !== 'ADVANCE' && linksRes.rows.length > 0) {
        const unfinished = linksRes.rows.filter((s) => !s.is_accepted);
        if (unfinished.length > 0) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `Chưa thể xác nhận PAID vì Mốc liên kết (${unfinished.map((u) => u.code).join(', ')}) chưa Finish`,
            'payment_status'
          );
        }
      }

      const paidRes = await client.query(
        `
          UPDATE payment_installments
          SET payment_status = 'PAID', paid_date = COALESCE($1::timestamptz, NOW()), updated_at = NOW()
          WHERE installment_id = $2
          RETURNING *
        `,
        [paidDate, installmentId]
      );

      // Rule #5: Mở khóa ngay chi 50% thưởng cho các Mốc liên kết đã Finish và có Surplus > 0
      const unlockedScopes = [];
      for (const s of linksRes.rows) {
        if (s.is_accepted && Number(s.limit_mandays || 0) > Number(s.actual_mandays || 0)) {
          const otherUnpaidRes = await client.query(
            `
              SELECT COUNT(*)::int AS unpaid_count
              FROM installment_milestone_links l2
              INNER JOIN payment_installments i2 ON i2.installment_id = l2.installment_id AND i2.deleted_at IS NULL
              WHERE l2.scope_item_id = $1 AND i2.payment_status <> 'PAID'
            `,
            [s.scope_item_id]
          );
          if ((otherUnpaidRes.rows[0]?.unpaid_count || 0) === 0) {
            await client.query(
              `UPDATE scope_items SET bonus_payout_status = 'ELIGIBLE', updated_at = NOW() WHERE scope_item_id = $1 AND bonus_payout_status = 'LOCKED'`,
              [s.scope_item_id]
            );
            unlockedScopes.push(s.scope_item_id);
          }
        }
      }

      if (actorId) {
        await client.query(
          `INSERT INTO audit_logs (entity_name, entity_id, action, new_values, changed_by)
           VALUES ('payment_installments', $1, 'MARK_INSTALLMENT_PAID', $2::jsonb, $3)`,
          [installmentId, JSON.stringify({ unlocked_scopes: unlockedScopes }), actorId]
        );
      }

      // Tự động kiểm tra giai đoạn Pre-Project: nếu đã đủ 4/4 điều kiện & Tạm ứng Đợt 1 PAID -> tự động Kick-off sang IN_PROJECT
      const autoKickoffRes = await scopeItemRepoForAutoCheck.tryAutoKickoffWithClient(
        client,
        inst.contract_id,
        actorId
      );

      await client.query('COMMIT');
      return {
        installment: paidRes.rows[0],
        unlocked_scope_ids: unlockedScopes,
        auto_kicked_off: Boolean(autoKickoffRes?.autoKickedOff),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // 3. GATEKEEPER #2: ĐÓNG DỰ ÁN & QUYẾT TOÁN KPI (5 ĐIỀU KIỆN CỨNG)
  // ===========================================================================
  async closeProjectTransaction(contractId, { kpiBonusSplitPercent = 50, handover = null, actorId = null } = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const cRes = await client.query(
        `SELECT * FROM contracts WHERE contract_id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [contractId]
      );
      if (cRes.rows.length === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy hợp đồng', 'contractId');
      }
      const contract = cRes.rows[0];
      if (contract.phase === 'CLOSED') {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Dự án đã Đóng sổ trước đó', 'phase');
      }

      const effectiveHandover = handover || contract.handover || {};
      if (handover) {
        await client.query(
          `UPDATE contracts SET handover = $1::jsonb, updated_at = NOW() WHERE contract_id = $2`,
          [JSON.stringify(effectiveHandover), contractId]
        );
      }

      // 1. 100% Scope Items Finish
      const unacceptedRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM scope_items WHERE contract_id = $1 AND deleted_at IS NULL AND is_accepted = false`,
        [contractId]
      );
      if ((unacceptedRes.rows[0]?.cnt || 0) > 0) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Chưa đủ điều kiện Đóng dự án: Vẫn còn Mốc bàn giao chưa Finish (100%)',
          'scope_items'
        );
      }

      // 2. 3/3 Handover
      const isHandoverComplete = Boolean(
        effectiveHandover.sourceCodeDelivered &&
          effectiveHandover.userGuideAndVideoDelivered &&
          effectiveHandover.signedAcceptanceScanUploaded
      );
      if (!isHandoverComplete) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Chưa đủ điều kiện Đóng dự án: Cần hoàn tất 3/3 mục Bàn giao & Scan BBNT',
          'handover'
        );
      }

      // 3 & 4. 100% Đợt PAID & 100% VAT ISSUED
      const unpaidRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM payment_installments WHERE contract_id = $1 AND deleted_at IS NULL AND payment_status <> 'PAID'`,
        [contractId]
      );
      if ((unpaidRes.rows[0]?.cnt || 0) > 0) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Chưa đủ điều kiện Đóng dự án: Vẫn còn Đợt thanh toán chưa đạt PAID',
          'installments'
        );
      }

      const unissuedVatRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM payment_installments WHERE contract_id = $1 AND deleted_at IS NULL AND vat_taxable_base_amount > 0 AND vat_invoice_status <> 'ISSUED'`,
        [contractId]
      );
      if ((unissuedVatRes.rows[0]?.cnt || 0) > 0) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Chưa đủ điều kiện Đóng dự án: Vẫn còn Hóa đơn VAT chưa xuất (ISSUED)',
          'vat_invoice_status'
        );
      }

      // 5. Rule #7: 100% am_expenses đã REIMBURSED (hoặc REJECTED)
      const unreimbursedExpRes = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM am_expenses WHERE contract_id = $1 AND deleted_at IS NULL AND status NOT IN ('REIMBURSED', 'REJECTED')`,
        [contractId]
      );
      if ((unreimbursedExpRes.rows[0]?.cnt || 0) > 0) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Chưa đủ điều kiện Đóng dự án: Vẫn còn khoản chi phí AM chưa hoàn ứng (REIMBURSED)',
          'am_expenses'
        );
      }

      const closedRes = await client.query(
        `
          UPDATE contracts
          SET
            phase = 'CLOSED',
            kpi_bonus_split_percent = $1,
            closed_at = NOW(),
            closed_by = $2,
            updated_at = NOW()
          WHERE contract_id = $3
          RETURNING *
        `,
        [Number(kpiBonusSplitPercent ?? 50), actorId, contractId]
      );

      if (actorId) {
        await client.query(
          `INSERT INTO audit_logs (entity_name, entity_id, action, old_values, new_values, changed_by)
           VALUES ('contracts', $1, 'CLOSE_CONTRACT', $2::jsonb, $3::jsonb, $4)`,
          [
            contractId,
            JSON.stringify({ phase: contract.phase }),
            JSON.stringify({ phase: 'CLOSED', kpi_bonus_split_percent: kpiBonusSplitPercent }),
            actorId,
          ]
        );
      }

      await client.query('COMMIT');
      return closedRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // ===========================================================================
  // 4. AM EXPENSES & DASHBOARD SUMMARY
  // ===========================================================================
  async listAmExpenses({ page = 1, limit = 20, contractId = '', status = '' } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions = ['e.deleted_at IS NULL', 'c.deleted_at IS NULL'];
    const params = [];

    if (contractId) {
      params.push(contractId);
      conditions.push(`e.contract_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`e.status = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS total FROM am_expenses e INNER JOIN contracts c ON c.contract_id = e.contract_id WHERE ${whereClause}`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const listParams = [...params, safeLimit, offset];
    const listRes = await db.query(
      `
        SELECT e.*, c.code AS contract_code, c.name AS contract_name, s.code AS scope_code, u.full_name AS created_by_name
        FROM am_expenses e
        INNER JOIN contracts c ON c.contract_id = e.contract_id
        LEFT JOIN scope_items s ON s.scope_item_id = e.scope_item_id
        LEFT JOIN users u ON u.user_id = e.created_by
        WHERE ${whereClause}
        ORDER BY e.expense_date DESC, e.created_at DESC
        LIMIT $${listParams.length - 1}
        OFFSET $${listParams.length}
      `,
      listParams
    );

    return {
      items: listRes.rows.map((r) => ({ ...r, amount_vnd: Number(r.amount_vnd || 0) })),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }

  async createAmExpense(payload, actorId) {
    const seqRes = await db.query("SELECT nextval('seq_expense_code')::int AS seq");
    const code = `EXP-${String(seqRes.rows[0].seq).padStart(4, '0')}`;

    const res = await db.query(
      `
        INSERT INTO am_expenses (
          contract_id, scope_item_id, code, expense_date, category, description, amount_vnd, status, receipt_url, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_REIMBURSE', $8, $9)
        RETURNING *
      `,
      [
        payload.contract_id,
        payload.scope_item_id || null,
        code,
        payload.expense_date || new Date().toISOString().slice(0, 10),
        payload.category || 'OTHER',
        payload.description,
        Math.round(Number(payload.amount_vnd || 0)),
        payload.receipt_url || null,
        actorId,
      ]
    );
    return res.rows[0];
  }

  async updateAmExpenseStatus(expenseId, status, actorId) {
    const isReimbursed = status === 'REIMBURSED';
    const res = await db.query(
      `
        UPDATE am_expenses
        SET
          status = $1::varchar,
          reimbursed_by = CASE WHEN $2::boolean THEN $3::uuid ELSE reimbursed_by END,
          reimbursed_at = CASE WHEN $2::boolean THEN NOW() ELSE reimbursed_at END,
          updated_at = NOW()
        WHERE expense_id = $4::uuid AND deleted_at IS NULL
        RETURNING *
      `,
      [status, isReimbursed, actorId || null, expenseId]
    );
    if (res.rows.length === 0) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy khoản chi phí AM', 'expenseId');
    }
    return res.rows[0];
  }

  async getDashboardSummary() {
    const [contractAgg, instAgg, expAgg, overdueLogs] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)::int AS total_contracts,
          COUNT(*) FILTER (WHERE phase = 'PRE_PROJECT')::int AS pre_project_count,
          COUNT(*) FILTER (WHERE phase = 'IN_PROJECT')::int AS in_project_count,
          COUNT(*) FILTER (WHERE phase = 'POST_PROJECT')::int AS post_project_count,
          COUNT(*) FILTER (WHERE phase = 'CLOSED')::int AS closed_count,
          COALESCE(SUM(base_contract_value + approved_upsell_value), 0)::bigint AS total_portfolio_value
        FROM contracts
        WHERE deleted_at IS NULL
      `),
      db.query(`
        SELECT
          COALESCE(SUM(amount_total) FILTER (WHERE payment_status = 'PAID'), 0)::bigint AS total_paid_amount,
          COALESCE(SUM(amount_total) FILTER (WHERE payment_status = 'OVERDUE'), 0)::bigint AS total_overdue_amount,
          COUNT(*) FILTER (WHERE vat_invoice_status = 'SENT_TO_ACCOUNTANT')::int AS vat_queue_count
        FROM payment_installments
        WHERE deleted_at IS NULL
      `),
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status NOT IN ('REIMBURSED', 'REJECTED'))::int AS unreimbursed_count,
          COALESCE(SUM(amount_vnd) FILTER (WHERE status NOT IN ('REIMBURSED', 'REJECTED')), 0)::bigint AS unreimbursed_amount
        FROM am_expenses
        WHERE deleted_at IS NULL
      `),
      db.query(`
        SELECT
          c.contract_id,
          c.code,
          c.name,
          c.check_cycle_days,
          c.last_check_in_date,
          (CURRENT_DATE - COALESCE(c.last_check_in_date, c.start_date))::int AS days_since_check
        FROM contracts c
        WHERE c.deleted_at IS NULL
          AND c.phase = 'IN_PROJECT'
          AND (CURRENT_DATE - COALESCE(c.last_check_in_date, c.start_date)) >= c.check_cycle_days
        ORDER BY days_since_check DESC
        LIMIT 20
      `),
    ]);

    return {
      contracts: contractAgg.rows[0],
      financials: instAgg.rows[0],
      am_expenses: expAgg.rows[0],
      overdue_checkins: overdueLogs.rows,
    };
  }
}

module.exports = PostgresSprint3Repository;
