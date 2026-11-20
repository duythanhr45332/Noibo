const db = require('../../config/database');
const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');

class PostgresScopeItemRepository {
  async findByIdWithContract(scopeItemId) {
    const query = `
      SELECT
        s.*,
        c.contract_id,
        c.code AS contract_code,
        c.phase AS contract_phase,
        c.initial_max_mandays,
        c.upsell_added_mandays,
        c.standard_manday_rate,
        c.kpi_bonus_split_percent
      FROM scope_items s
      INNER JOIN contracts c ON c.contract_id = s.contract_id AND c.deleted_at IS NULL
      WHERE s.scope_item_id = $1 AND s.deleted_at IS NULL
    `;
    const res = await db.query(query, [scopeItemId]);
    return res.rows[0] || null;
  }

  async sumLimitsByContract(contractId, excludeScopeItemId = null) {
    const params = [contractId];
    let query = `
      SELECT COALESCE(SUM(limit_mandays), 0)::numeric(10,2) AS total_limit
      FROM scope_items
      WHERE contract_id = $1 AND deleted_at IS NULL
    `;
    if (excludeScopeItemId) {
      params.push(excludeScopeItemId);
      query += ` AND scope_item_id <> $2`;
    }
    const res = await db.query(query, params);
    return Number(res.rows[0]?.total_limit || 0);
  }

  async createForContract(contractId, data) {
    const sortRes = await db.query(
      `SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next_order FROM scope_items WHERE contract_id = $1 AND deleted_at IS NULL`,
      [contractId]
    );
    const nextOrder = sortRes.rows[0]?.next_order || 1;
    const code = (data.code || `MỐC-0${nextOrder}`).trim();

    const res = await db.query(
      `
        INSERT INTO scope_items (
          contract_id, code, title, module_name, description, owner_pic,
          sort_order, source, vat_category, amount_before_vat,
          limit_mandays, target_mandays, estimated_mandays, handover_estimated_mandays,
          due_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'BASELINE', $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `,
      [
        contractId,
        code,
        data.title,
        data.module_name || data.title,
        data.description || '',
        data.owner_pic || null,
        nextOrder,
        data.vat_category || 'NON_VAT',
        Math.round(Number(data.amount_before_vat || 0)),
        Number(data.limit_mandays || 0),
        Number(data.target_mandays || 0),
        Number(data.estimated_mandays || 0),
        Number(data.handover_estimated_mandays || 0),
        data.due_date || null,
      ]
    );

    const created = res.rows[0];
    if (created && Number(data.limit_mandays || 0) > 0) {
      await this.syncDynamicMandayRate(contractId);
    }
    return created;
  }

  async updateFields(scopeItemId, patch) {
    const fields = [];
    const params = [];

    const allowedCols = [
      'title',
      'module_name',
      'description',
      'owner_pic',
      'due_date',
      'amount_before_vat',
      'vat_category',
      'limit_mandays',
      'target_mandays',
      'estimated_mandays',
      'handover_estimated_mandays',
      'pm_note',
      'blocker_note',
    ];

    for (const col of allowedCols) {
      if (patch[col] !== undefined) {
        params.push(patch[col]);
        fields.push(`${col} = $${params.length}`);
      }
    }

    if (fields.length === 0) {
      return this.findByIdWithContract(scopeItemId);
    }

    fields.push('updated_at = NOW()');
    params.push(scopeItemId);

    const res = await db.query(
      `UPDATE scope_items SET ${fields.join(', ')} WHERE scope_item_id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    );
    const updatedRow = res.rows[0] || null;
    if (updatedRow && patch.limit_mandays !== undefined) {
      await this.syncDynamicMandayRate(updatedRow.contract_id);
    }
    return updatedRow;
  }

  async syncDynamicMandayRate(contractId) {
    if (!contractId) return;
    const aggRes = await db.query(
      `
        SELECT
          c.am_allocation_vnd,
          COALESCE(SUM(s.limit_mandays), 0)::numeric(10,2) AS total_limit_md
        FROM contracts c
        LEFT JOIN scope_items s ON s.contract_id = c.contract_id AND s.deleted_at IS NULL
        WHERE c.contract_id = $1 AND c.deleted_at IS NULL
        GROUP BY c.contract_id
      `,
      [contractId]
    );
    const row = aggRes.rows[0];
    if (!row) return;
    const creditY = Number(row.am_allocation_vnd || 0);
    const totalLimit = Number(row.total_limit_md || 0);
    if (creditY > 0 && totalLimit > 0) {
      const dynamicRate = Math.max(100000, Math.floor(creditY / totalLimit));
      await db.query(
        `
          UPDATE contracts
          SET
            initial_max_mandays = $1,
            standard_manday_rate = $2,
            internal_unit_price = $2,
            updated_at = NOW()
          WHERE contract_id = $3 AND deleted_at IS NULL
        `,
        [Math.round(totalLimit), dynamicRate, contractId]
      );
    }
  }

  async evaluatePreProjectReadiness(client, contract) {
    const checklist = contract.kickoff_checklist || {};
    const hasDriveUrl = Boolean(String(contract.drive_root_url || '').trim());
    const isDriveReady = Boolean(
      contract.drive_permissions_verified ||
        hasDriveUrl ||
        (checklist.driveRootCreated &&
          checklist.driveTeamDocCreated &&
          checklist.driveSharedDocCreated &&
          checklist.drivePermissionsGranted)
    );

    const scopeAggRes = await client.query(
      `
        SELECT
          COUNT(*)::int AS scope_count,
          COALESCE(SUM(limit_mandays), 0)::numeric(10,2) AS total_limit,
          COALESCE(SUM(handover_estimated_mandays), 0)::numeric(10,2) AS total_bg
        FROM scope_items
        WHERE contract_id = $1 AND deleted_at IS NULL
      `,
      [contract.contract_id]
    );
    const scopeCount = Number(scopeAggRes.rows[0]?.scope_count || 0);
    const totalLimit = Number(scopeAggRes.rows[0]?.total_limit || 0);
    const totalBg = Number(scopeAggRes.rows[0]?.total_bg || 0);

    const isProjectDocReady = Boolean(
      checklist.pmConfirmedScope || (scopeCount > 0 && totalLimit > 0)
    );
    const isTimelineReady = Boolean(
      checklist.kickoffTimelineConfirmed || (contract.start_date && contract.end_date)
    );
    const isHandoverEstimateReady = Boolean(
      checklist.handoverEstimateConfirmed || totalBg > 0
    );

    const paidInstRes = await client.query(
      `
        SELECT installment_id, payment_status
        FROM payment_installments
        WHERE contract_id = $1 AND deleted_at IS NULL
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1
      `,
      [contract.contract_id]
    );
    const firstInstallment = paidInstRes.rows[0];
    const isAdvancePaid = Boolean(
      firstInstallment && firstInstallment.payment_status === 'PAID'
    );

    return {
      isDriveReady,
      isProjectDocReady,
      isTimelineReady,
      isHandoverEstimateReady,
      isAllChecklistReady:
        isDriveReady && isProjectDocReady && isTimelineReady && isHandoverEstimateReady,
      isAdvancePaid,
      totalBg,
      canKickoff:
        isDriveReady &&
        isProjectDocReady &&
        isTimelineReady &&
        isHandoverEstimateReady &&
        isAdvancePaid,
    };
  }

  async tryAutoKickoffWithClient(client, contractId, actorId = null) {
    const cRes = await client.query(
      `SELECT * FROM contracts WHERE contract_id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [contractId]
    );
    if (cRes.rows.length === 0) return { autoKickedOff: false };
    const contract = cRes.rows[0];
    if (contract.phase !== 'PRE_PROJECT') return { autoKickedOff: false };

    const readiness = await this.evaluatePreProjectReadiness(client, contract);
    if (!readiness.canKickoff) return { autoKickedOff: false, readiness };

    await client.query(
      `
        UPDATE contracts
        SET
          phase = 'IN_PROJECT',
          drive_permissions_verified = true,
          updated_at = NOW()
        WHERE contract_id = $1
      `,
      [contractId]
    );

    // Tự động kích hoạt Mốc đầu tiên từ NOT_STARTED -> IN_PROGRESS nếu chưa có mốc nào chạy
    await client.query(
      `
        UPDATE scope_items
        SET execution_status = 'IN_PROGRESS', updated_at = NOW()
        WHERE scope_item_id = (
          SELECT scope_item_id
          FROM scope_items
          WHERE contract_id = $1 AND deleted_at IS NULL AND execution_status = 'NOT_STARTED'
          ORDER BY sort_order ASC, created_at ASC
          LIMIT 1
        )
      `,
      [contractId]
    );

    if (actorId) {
      await client.query(
        `INSERT INTO audit_logs (entity_name, entity_id, action, old_values, new_values, changed_by)
         VALUES ('contracts', $1, 'KICKOFF_CONTRACT', $2::jsonb, $3::jsonb, $4)`,
        [
          contractId,
          JSON.stringify({ phase: 'PRE_PROJECT' }),
          JSON.stringify({
            phase: 'IN_PROJECT',
            auto_checked: true,
            total_handover_estimate_md: readiness.totalBg,
          }),
          actorId,
        ]
      );
    }

    return { autoKickedOff: true, readiness };
  }

  async tryAutoKickoff(contractId, actorId = null) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.tryAutoKickoffWithClient(client, contractId, actorId);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async kickoffContractTransaction(contractId, actorId) {
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

      if (contract.phase !== 'PRE_PROJECT') {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `Hợp đồng đang ở giai đoạn ${contract.phase}, chỉ Kick-off được từ PRE_PROJECT`,
          'phase'
        );
      }

      const readiness = await this.evaluatePreProjectReadiness(client, contract);

      if (!readiness.isAllChecklistReady) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Chưa hoàn tất đủ 4/4 điều kiện Checklist Kick-off (Drive, Scope, Timeline, Ước tính bàn giao)',
          'kickoff_checklist'
        );
      }

      if (!readiness.isAdvancePaid) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Khách hàng bắt buộc phải thanh toán Tạm ứng Đợt 1 (PAID) ngay sau khi ký HĐ mới được bắt đầu dự án',
          'payment_status'
        );
      }

      const updatedRes = await client.query(
        `UPDATE contracts SET phase = 'IN_PROJECT', drive_permissions_verified = true, updated_at = NOW() WHERE contract_id = $1 RETURNING *`,
        [contractId]
      );

      await client.query(
        `
          UPDATE scope_items
          SET execution_status = 'IN_PROGRESS', updated_at = NOW()
          WHERE scope_item_id = (
            SELECT scope_item_id
            FROM scope_items
            WHERE contract_id = $1 AND deleted_at IS NULL AND execution_status = 'NOT_STARTED'
            ORDER BY sort_order ASC, created_at ASC
            LIMIT 1
          )
        `,
        [contractId]
      );

      if (actorId) {
        await client.query(
          `INSERT INTO audit_logs (entity_name, entity_id, action, old_values, new_values, changed_by)
           VALUES ('contracts', $1, 'KICKOFF_CONTRACT', $2::jsonb, $3::jsonb, $4)`,
          [
            contractId,
            JSON.stringify({ phase: 'PRE_PROJECT' }),
            JSON.stringify({ phase: 'IN_PROJECT', total_handover_estimate_md: readiness.totalBg }),
            actorId,
          ]
        );
      }

      await client.query('COMMIT');
      return updatedRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async logMandaysTransaction(scopeItemId, input, actorId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `
          SELECT s.*, c.phase AS contract_phase
          FROM scope_items s
          INNER JOIN contracts c ON c.contract_id = s.contract_id AND c.deleted_at IS NULL
          WHERE s.scope_item_id = $1 AND s.deleted_at IS NULL
          FOR UPDATE OF s
        `,
        [scopeItemId]
      );

      if (lockRes.rows.length === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy Mốc bàn giao', 'scopeItemId');
      }

      const scope = lockRes.rows[0];

      if (scope.contract_phase === 'PRE_PROJECT') {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Dự án đang ở PRE_PROJECT, vui lòng Start Project (Kick-off) trước khi Log Mandays',
          'phase'
        );
      }
      if (scope.contract_phase === 'CLOSED') {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Dự án đã Đóng sổ (CLOSED), không thể Log Mandays',
          'phase'
        );
      }
      if (scope.is_accepted) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Mốc này đã Finish (nghiệm thu). Hãy Reopen Mốc trước nếu cần ghi nhận thêm ngày công.',
          'is_accepted'
        );
      }

      const prevActual = Number(scope.actual_mandays || 0);
      let nextActual = prevActual;
      let delta = 0;

      if (input.new_cumulative_mandays !== undefined && input.new_cumulative_mandays !== null) {
        nextActual = Math.max(0, Number(input.new_cumulative_mandays));
        delta = Math.round((nextActual - prevActual) * 100) / 100;
      } else {
        delta = Number(input.delta_mandays || 0);
        nextActual = Math.max(0, Math.round((prevActual + delta) * 100) / 100);
      }

      const prevProgress = Number(scope.progress_percent || 0);
      const nextProgress =
        input.progress_percent !== undefined
          ? Math.min(100, Math.max(0, Number(input.progress_percent)))
          : prevProgress;
      const nextStatus =
        input.execution_status || (nextActual > 0 ? 'IN_PROGRESS' : scope.execution_status);
      const checkDate = input.check_date || new Date().toISOString().slice(0, 10);

      await client.query(
        `
          UPDATE scope_items
          SET
            actual_mandays = $1,
            progress_percent = $2,
            execution_status = $3,
            last_check_date = $4,
            blocker_note = COALESCE($5, blocker_note),
            updated_at = NOW()
          WHERE scope_item_id = $6
        `,
        [
          nextActual,
          nextProgress,
          nextStatus,
          checkDate,
          input.blocker_note !== undefined ? input.blocker_note : null,
          scopeItemId,
        ]
      );

      await client.query(
        `UPDATE contracts SET last_check_in_date = $1, updated_at = NOW() WHERE contract_id = $2`,
        [checkDate, scope.contract_id]
      );

      const logRes = await client.query(
        `
          INSERT INTO scope_progress_logs (
            contract_id, scope_item_id, log_type,
            delta_mandays, cumulative_mandays, previous_actual_mandays,
            limit_mandays_snapshot, previous_progress_percent, new_progress_percent,
            check_date, note, blocker_note, logged_by
          )
          VALUES ($1, $2, 'PERIODIC_CHECK', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `,
        [
          scope.contract_id,
          scopeItemId,
          delta,
          nextActual,
          prevActual,
          Number(scope.limit_mandays || 0),
          prevProgress,
          nextProgress,
          checkDate,
          input.note || '',
          input.blocker_note || null,
          actorId,
        ]
      );

      await client.query('COMMIT');
      return {
        scope_item_id: scopeItemId,
        previous_actual_mandays: prevActual,
        actual_mandays: nextActual,
        delta_mandays: delta,
        log: logRes.rows[0],
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async finishMilestoneTransaction(scopeItemId, { note = '', actorId = null } = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `
          SELECT s.*, c.phase AS contract_phase, c.standard_manday_rate, c.kpi_bonus_split_percent
          FROM scope_items s
          INNER JOIN contracts c ON c.contract_id = s.contract_id AND c.deleted_at IS NULL
          WHERE s.scope_item_id = $1 AND s.deleted_at IS NULL
          FOR UPDATE OF s
        `,
        [scopeItemId]
      );

      if (lockRes.rows.length === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy Mốc bàn giao', 'scopeItemId');
      }

      const scope = lockRes.rows[0];
      if (scope.contract_phase === 'PRE_PROJECT') {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Không thể Finish Mốc khi dự án đang ở giai đoạn PRE_PROJECT',
          'phase'
        );
      }
      if (scope.contract_phase === 'CLOSED') {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Dự án đã Đóng sổ (CLOSED)',
          'phase'
        );
      }
      if (scope.is_accepted) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Mốc này đã Finish trước đó',
          'is_accepted'
        );
      }

      const limitMd = Number(scope.limit_mandays || 0);
      const realMd = Number(scope.actual_mandays || 0);
      const surplusMd = Math.round((limitMd - realMd) * 100) / 100;

      // Tách riêng trạng thái hòa vốn AT_LIMIT khi Real === Limit
      const efficiencyStatus =
        realMd < limitMd ? 'SAVED' : realMd === limitMd ? 'AT_LIMIT' : 'OVER_LIMIT';

      const splitPct = Number(scope.kpi_bonus_split_percent ?? 50);
      const bonusMd = surplusMd > 0 ? Math.round(surplusMd * (splitPct / 100) * 100) / 100 : 0;
      const bonusVnd = Math.round(bonusMd * Number(scope.standard_manday_rate || 2500000));

      // Kiểm tra các đợt thanh toán liên kết đã PAID hết chưa để mở khóa chi 50% thưởng ngay (Rule #5)
      const instRes = await client.query(
        `
          SELECT i.installment_id, i.payment_status
          FROM installment_milestone_links l
          INNER JOIN payment_installments i
            ON i.installment_id = l.installment_id AND i.deleted_at IS NULL
          WHERE l.scope_item_id = $1
        `,
        [scopeItemId]
      );

      const linkedInstallments = instRes.rows;
      const allLinkedPaid =
        linkedInstallments.length > 0 &&
        linkedInstallments.every((inst) => inst.payment_status === 'PAID');

      const nextBonusPayoutStatus =
        surplusMd > 0 && allLinkedPaid ? 'ELIGIBLE' : 'LOCKED';

      await client.query(
        `
          UPDATE scope_items
          SET
            is_accepted = true,
            progress_percent = 100,
            execution_status = 'COMPLETED',
            finished_at = NOW(),
            accepted_date = NOW(),
            acceptance_note = $1,
            bonus_payout_status = $2,
            bonus_paid_amount = CASE WHEN $3 > 0 THEN $3 ELSE bonus_paid_amount END,
            updated_at = NOW()
          WHERE scope_item_id = $4
        `,
        [note || 'Đã Finish Mốc bàn giao', nextBonusPayoutStatus, bonusVnd, scopeItemId]
      );

      await client.query(
        `
          INSERT INTO scope_progress_logs (
            contract_id, scope_item_id, log_type,
            delta_mandays, cumulative_mandays, previous_actual_mandays,
            limit_mandays_snapshot, previous_progress_percent, new_progress_percent,
            check_date, note, logged_by
          )
          VALUES ($1, $2, 'FINISH_MILESTONE', 0, $3, $3, $4, $5, 100, CURRENT_DATE, $6, $7)
        `,
        [
          scope.contract_id,
          scopeItemId,
          realMd,
          limitMd,
          Number(scope.progress_percent || 0),
          note || `Finish ${scope.code} (${efficiencyStatus}, dôi dư ${surplusMd} MD)`,
          actorId,
        ]
      );

      // Kiểm tra 100% Mốc đã Finish chưa -> tự động chuyển phase sang POST_PROJECT
      const remainingRes = await client.query(
        `SELECT COUNT(*)::int AS remaining FROM scope_items WHERE contract_id = $1 AND deleted_at IS NULL AND is_accepted = false`,
        [scope.contract_id]
      );
      let nextPhase = scope.contract_phase;
      if ((remainingRes.rows[0]?.remaining || 0) === 0 && scope.contract_phase === 'IN_PROJECT') {
        await client.query(
          `UPDATE contracts SET phase = 'POST_PROJECT', updated_at = NOW() WHERE contract_id = $1`,
          [scope.contract_id]
        );
        nextPhase = 'POST_PROJECT';
      }

      if (actorId) {
        await client.query(
          `INSERT INTO audit_logs (entity_name, entity_id, action, new_values, changed_by)
           VALUES ('scope_items', $1, 'FINISH_MILESTONE', $2::jsonb, $3)`,
          [
            scopeItemId,
            JSON.stringify({
              efficiency_status: efficiencyStatus,
              surplus_md: surplusMd,
              bonus_payout_status: nextBonusPayoutStatus,
              bonus_vnd: bonusVnd,
              contract_phase: nextPhase,
            }),
            actorId,
          ]
        );
      }

      await client.query('COMMIT');
      return {
        scope_item_id: scopeItemId,
        efficiency_status: efficiencyStatus,
        surplus_mandays: surplusMd,
        bonus_mandays: bonusMd,
        bonus_vnd: bonusVnd,
        bonus_payout_status: nextBonusPayoutStatus,
        contract_phase: nextPhase,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async reopenMilestoneTransaction(scopeItemId, { reason = '', actorId = null } = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `
          SELECT s.*, c.phase AS contract_phase
          FROM scope_items s
          INNER JOIN contracts c ON c.contract_id = s.contract_id AND c.deleted_at IS NULL
          WHERE s.scope_item_id = $1 AND s.deleted_at IS NULL
          FOR UPDATE OF s
        `,
        [scopeItemId]
      );

      if (lockRes.rows.length === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy Mốc bàn giao', 'scopeItemId');
      }

      const scope = lockRes.rows[0];
      if (scope.contract_phase === 'CLOSED') {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Dự án đã Đóng sổ (CLOSED), không thể Reopen Mốc',
          'phase'
        );
      }
      if (!scope.is_accepted) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Mốc này chưa Finish nên không cần Reopen',
          'is_accepted'
        );
      }

      const nextBonusPayoutStatus =
        scope.bonus_payout_status === 'DISBURSED' ? 'CLAWBACK_PENDING' : 'LOCKED';

      await client.query(
        `
          UPDATE scope_items
          SET
            is_accepted = false,
            execution_status = 'IN_PROGRESS',
            progress_percent = 90,
            finished_at = NULL,
            accepted_date = NULL,
            bonus_payout_status = $1,
            updated_at = NOW()
          WHERE scope_item_id = $2
        `,
        [nextBonusPayoutStatus, scopeItemId]
      );

      let nextPhase = scope.contract_phase;
      if (scope.contract_phase === 'POST_PROJECT') {
        await client.query(
          `UPDATE contracts SET phase = 'IN_PROJECT', updated_at = NOW() WHERE contract_id = $1`,
          [scope.contract_id]
        );
        nextPhase = 'IN_PROJECT';
      }

      await client.query(
        `
          INSERT INTO scope_progress_logs (
            contract_id, scope_item_id, log_type,
            delta_mandays, cumulative_mandays, previous_actual_mandays,
            limit_mandays_snapshot, previous_progress_percent, new_progress_percent,
            check_date, note, logged_by
          )
          VALUES ($1, $2, 'REOPEN_MILESTONE', 0, $3, $3, $4, 100, 90, CURRENT_DATE, $5, $6)
        `,
        [
          scope.contract_id,
          scopeItemId,
          Number(scope.actual_mandays || 0),
          Number(scope.limit_mandays || 0),
          reason || 'Mở lại Mốc (Reopen) để xử lý bổ sung',
          actorId,
        ]
      );

      if (actorId) {
        await client.query(
          `INSERT INTO audit_logs (entity_name, entity_id, action, old_values, new_values, changed_by)
           VALUES ('scope_items', $1, 'REOPEN_MILESTONE', $2::jsonb, $3::jsonb, $4)`,
          [
            scopeItemId,
            JSON.stringify({
              bonus_payout_status: scope.bonus_payout_status,
              contract_phase: scope.contract_phase,
            }),
            JSON.stringify({
              bonus_payout_status: nextBonusPayoutStatus,
              contract_phase: nextPhase,
              reason,
            }),
            actorId,
          ]
        );
      }

      await client.query('COMMIT');
      return {
        scope_item_id: scopeItemId,
        bonus_payout_status: nextBonusPayoutStatus,
        contract_phase: nextPhase,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async disburseBonusTransaction(scopeItemId, { note = '', actorId = null } = {}) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const lockRes = await client.query(
        `
          SELECT s.*, c.phase AS contract_phase, c.standard_manday_rate, c.kpi_bonus_split_percent
          FROM scope_items s
          INNER JOIN contracts c ON c.contract_id = s.contract_id AND c.deleted_at IS NULL
          WHERE s.scope_item_id = $1 AND s.deleted_at IS NULL
          FOR UPDATE OF s
        `,
        [scopeItemId]
      );

      if (lockRes.rows.length === 0) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy Mốc bàn giao', 'scopeItemId');
      }

      const scope = lockRes.rows[0];
      if (!scope.is_accepted) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Mốc bàn giao chưa Finish (nghiệm thu), chưa thể xác nhận thực chi thưởng 50%',
          'is_accepted'
        );
      }

      if (scope.bonus_payout_status === 'DISBURSED') {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Khoản thưởng 50% của Mốc này đã được xác nhận thực chi trước đó',
          'bonus_payout_status'
        );
      }

      const limitMd = Number(scope.limit_mandays || 0);
      const realMd = Number(scope.actual_mandays || 0);
      const surplusMd = Math.round((limitMd - realMd) * 100) / 100;

      if (surplusMd <= 0) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `Mốc ${scope.code} không có dôi dư (Surplus = ${surplusMd} MD), không phát sinh quỹ thưởng`,
          'surplus_mandays'
        );
      }

      const instRes = await client.query(
        `
          SELECT i.installment_id, i.code, i.payment_status
          FROM installment_milestone_links l
          INNER JOIN payment_installments i
            ON i.installment_id = l.installment_id AND i.deleted_at IS NULL
          WHERE l.scope_item_id = $1
        `,
        [scopeItemId]
      );

      const linkedInstallments = instRes.rows;
      if (linkedInstallments.length === 0) {
        const anyContractUnpaid = await client.query(
          `SELECT COUNT(*)::int AS cnt FROM payment_installments WHERE contract_id = $1 AND deleted_at IS NULL AND payment_status <> 'PAID'`,
          [scope.contract_id]
        );
        if ((anyContractUnpaid.rows[0]?.cnt || 0) > 0) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            'Chưa thể thực chi thưởng vì hợp đồng chưa thu đủ các đợt thanh toán (PAID)',
            'payment_status'
          );
        }
      } else {
        const unpaid = linkedInstallments.filter((i) => i.payment_status !== 'PAID');
        if (unpaid.length > 0) {
          throw new ApiError(
            HttpStatus.BAD_REQUEST,
            `Chưa thể thực chi thưởng 50% vì Đợt thanh toán liên kết (${unpaid.map((u) => u.code).join(', ')}) chưa đạt PAID`,
            'payment_status'
          );
        }
      }

      const splitPct = Number(scope.kpi_bonus_split_percent ?? 50);
      const bonusMd = Math.round(surplusMd * (splitPct / 100) * 100) / 100;
      const bonusVnd = Math.round(bonusMd * Number(scope.standard_manday_rate || 2500000));

      const updatedRes = await client.query(
        `
          UPDATE scope_items
          SET
            bonus_payout_status = 'DISBURSED',
            bonus_paid_amount = $1,
            bonus_disbursed_at = NOW(),
            updated_at = NOW()
          WHERE scope_item_id = $2
          RETURNING bonus_disbursed_at
        `,
        [bonusVnd, scopeItemId]
      );

      if (actorId) {
        await client.query(
          `INSERT INTO audit_logs (entity_name, entity_id, action, old_values, new_values, changed_by)
           VALUES ('scope_items', $1, 'DISBURSE_MILESTONE_BONUS', $2::jsonb, $3::jsonb, $4)`,
          [
            scopeItemId,
            JSON.stringify({ bonus_payout_status: scope.bonus_payout_status }),
            JSON.stringify({
              bonus_payout_status: 'DISBURSED',
              bonus_paid_amount: bonusVnd,
              bonus_mandays: bonusMd,
              note: note || 'Kế toán/BOD xác nhận đã thực chi thưởng 50%',
            }),
            actorId,
          ]
        );
      }

      await client.query('COMMIT');
      return {
        scope_item_id: scopeItemId,
        code: scope.code,
        bonus_payout_status: 'DISBURSED',
        bonus_mandays: bonusMd,
        bonus_paid_amount: bonusVnd,
        bonus_disbursed_at: updatedRes.rows[0]?.bonus_disbursed_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PostgresScopeItemRepository;
