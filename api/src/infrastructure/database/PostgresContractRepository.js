const db = require('../../config/database');

function mapContractSummary(row) {
  return {
    contract_id: row.contract_id,
    code: row.code,
    name: row.name,
    customer_id: row.customer_id,
    customer_name: row.customer_name || null,
    customer_code: row.customer_code || null,
    owner_am_id: row.owner_am_id,
    am_name: row.am_name || null,
    owner_pm_id: row.owner_pm_id,
    pm_name: row.pm_name || null,
    phase: row.phase,
    signed_date: row.signed_date,
    start_date: row.start_date,
    end_date: row.end_date,
    check_cycle_days: Number(row.check_cycle_days || 7),
    last_check_in_date: row.last_check_in_date,
    base_contract_value: Number(row.base_contract_value || 0),
    approved_upsell_value: Number(row.approved_upsell_value || 0),
    fixed_cost_allocation: Number(row.fixed_cost_allocation || 0),
    sales_commission_amount: Number(row.sales_commission_amount || 0),
    risk_reserve_percent: Number(row.risk_reserve_percent || 0),
    standard_manday_rate: Number(row.standard_manday_rate || row.internal_unit_price || 2500000),
    internal_unit_price: Number(row.internal_unit_price || 2500000),
    am_allocation_vnd: Number(row.am_allocation_vnd || 0),
    compression_ratio: Number(row.compression_ratio || 1),
    initial_max_mandays: Number(row.initial_max_mandays || 0),
    upsell_added_mandays: Number(row.upsell_added_mandays || 0),
    am_target_mandays: Number(row.am_target_mandays || 0),
    has_vat_items: Boolean(row.has_vat_items),
    has_non_vat_items: Boolean(row.has_non_vat_items),
    vat_rate_percent:
      row.vat_rate_percent !== undefined && row.vat_rate_percent !== null
        ? Number(row.vat_rate_percent)
        : 0,
    vat_portion_amount: Number(row.vat_portion_amount || 0),
    non_vat_portion_amount: Number(row.non_vat_portion_amount || 0),
    invoice_method: row.invoice_method || 'BY_INSTALLMENT',
    external_accountant_note: row.external_accountant_note || '',
    drive_root_url: row.drive_root_url || '',
    drive_permissions_verified: Boolean(row.drive_permissions_verified),
    kickoff_checklist: row.kickoff_checklist || {},
    bod_allow_kickoff_without_advance: Boolean(row.bod_allow_kickoff_without_advance),
    handover: row.handover || {},
    kpi_bonus_split_percent: Number(row.kpi_bonus_split_percent ?? 50),
    manual_force_red_flag: Boolean(row.manual_force_red_flag),
    manual_red_flag_reason: row.manual_red_flag_reason || null,
    quick_action_blocker: row.quick_action_blocker || '',
    am_custom_tags: row.am_custom_tags || [],
    am_advance_amount: Number(row.am_advance_amount || 0),
    closed_at: row.closed_at,
    closed_by: row.closed_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    // Aggregated manday & count summaries when available
    total_limit_mandays:
      row.total_limit_mandays !== undefined ? Number(row.total_limit_mandays) : undefined,
    total_target_mandays:
      row.total_target_mandays !== undefined ? Number(row.total_target_mandays) : undefined,
    total_estimated_mandays:
      row.total_estimated_mandays !== undefined ? Number(row.total_estimated_mandays) : undefined,
    total_actual_mandays:
      row.total_actual_mandays !== undefined ? Number(row.total_actual_mandays) : undefined,
    total_support_mandays:
      row.total_support_mandays !== undefined ? Number(row.total_support_mandays) : undefined,
    scope_count: row.scope_count !== undefined ? Number(row.scope_count) : undefined,
    accepted_scope_count:
      row.accepted_scope_count !== undefined ? Number(row.accepted_scope_count) : undefined,
  };
}

class PostgresContractRepository {
  async findAllPaginated({
    page = 1,
    limit = 20,
    search = '',
    phase = '',
    customerId = '',
    ownerAmId = '',
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions = ['c.deleted_at IS NULL'];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(c.code ILIKE $${params.length} OR c.name ILIKE $${params.length} OR cust.name ILIKE $${params.length})`
      );
    }

    if (phase && phase.trim()) {
      params.push(phase.trim());
      conditions.push(`c.phase = $${params.length}`);
    }

    if (customerId && customerId.trim()) {
      params.push(customerId.trim());
      conditions.push(`c.customer_id = $${params.length}`);
    }

    if (ownerAmId && ownerAmId.trim()) {
      params.push(ownerAmId.trim());
      conditions.push(`c.owner_am_id = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM contracts c
      LEFT JOIN customers cust ON cust.customer_id = c.customer_id
      WHERE ${whereClause}
    `;
    const countRes = await db.query(countQuery, params);
    const total = countRes.rows[0]?.total || 0;

    const listParams = [...params, safeLimit, offset];
    const listQuery = `
      SELECT
        c.*,
        cust.name AS customer_name,
        cust.code AS customer_code,
        u_am.full_name AS am_name,
        u_pm.full_name AS pm_name,
        COALESCE(SUM(s.limit_mandays), 0)::numeric(10,2) AS total_limit_mandays,
        COALESCE(SUM(s.target_mandays), 0)::numeric(10,2) AS total_target_mandays,
        COALESCE(SUM(s.estimated_mandays), 0)::numeric(10,2) AS total_estimated_mandays,
        COALESCE(SUM(s.actual_mandays), 0)::numeric(10,2) AS total_actual_mandays,
        COALESCE(SUM(s.support_mandays), 0)::numeric(10,2) AS total_support_mandays,
        COUNT(s.scope_item_id)::int AS scope_count,
        COUNT(s.scope_item_id) FILTER (WHERE s.is_accepted = true)::int AS accepted_scope_count
      FROM contracts c
      LEFT JOIN customers cust ON cust.customer_id = c.customer_id
      LEFT JOIN users u_am ON u_am.user_id = c.owner_am_id
      LEFT JOIN users u_pm ON u_pm.user_id = c.owner_pm_id
      LEFT JOIN scope_items s ON s.contract_id = c.contract_id AND s.deleted_at IS NULL
      WHERE ${whereClause}
      GROUP BY c.contract_id, cust.customer_id, u_am.user_id, u_pm.user_id
      ORDER BY c.created_at DESC
      LIMIT $${listParams.length - 1}
      OFFSET $${listParams.length}
    `;

    const listRes = await db.query(listQuery, listParams);
    const items = listRes.rows.map(mapContractSummary);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  async findByIdFull(contractId) {
    const baseQuery = `
      SELECT
        c.*,
        cust.name AS customer_name,
        cust.code AS customer_code,
        u_am.full_name AS am_name,
        u_pm.full_name AS pm_name
      FROM contracts c
      LEFT JOIN customers cust ON cust.customer_id = c.customer_id
      LEFT JOIN users u_am ON u_am.user_id = c.owner_am_id
      LEFT JOIN users u_pm ON u_pm.user_id = c.owner_pm_id
      WHERE c.contract_id = $1 AND c.deleted_at IS NULL
    `;
    const baseRes = await db.query(baseQuery, [contractId]);
    if (baseRes.rows.length === 0) return null;

    const contract = mapContractSummary(baseRes.rows[0]);

    const [scopesRes, instRes, linksRes, crsRes, expRes, docsRes, logsRes] = await Promise.all([
      db.query(
        `SELECT * FROM scope_items WHERE contract_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`,
        [contractId]
      ),
      db.query(
        `SELECT * FROM payment_installments WHERE contract_id = $1 AND deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC`,
        [contractId]
      ),
      db.query(
        `SELECT l.installment_id, l.scope_item_id
         FROM installment_milestone_links l
         INNER JOIN payment_installments i ON i.installment_id = l.installment_id
         WHERE i.contract_id = $1 AND i.deleted_at IS NULL`,
        [contractId]
      ),
      db.query(
        `SELECT * FROM change_requests WHERE contract_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
        [contractId]
      ),
      db.query(
        `SELECT * FROM am_expenses WHERE contract_id = $1 AND deleted_at IS NULL ORDER BY expense_date DESC, created_at DESC`,
        [contractId]
      ),
      db.query(
        `SELECT d.*, u.full_name AS uploaded_by_name
         FROM project_documents d
         LEFT JOIN users u ON u.user_id = d.uploaded_by
         WHERE d.contract_id = $1 AND d.deleted_at IS NULL
         ORDER BY d.created_at DESC`,
        [contractId]
      ),
      db.query(
        `SELECT l.*, u.full_name AS logged_by_name
         FROM scope_progress_logs l
         LEFT JOIN users u ON u.user_id = l.logged_by
         WHERE l.contract_id = $1
         ORDER BY l.created_at DESC
         LIMIT 200`,
        [contractId]
      ),
    ]);

    const linksByInst = new Map();
    for (const lk of linksRes.rows) {
      if (!linksByInst.has(lk.installment_id)) linksByInst.set(lk.installment_id, []);
      linksByInst.get(lk.installment_id).push(lk.scope_item_id);
    }

    const logsByScope = new Map();
    for (const lg of logsRes.rows) {
      if (!logsByScope.has(lg.scope_item_id)) logsByScope.set(lg.scope_item_id, []);
      logsByScope.get(lg.scope_item_id).push({
        log_id: lg.log_id,
        log_type: lg.log_type,
        delta_mandays: Number(lg.delta_mandays),
        cumulative_mandays: Number(lg.cumulative_mandays),
        previous_actual_mandays: Number(lg.previous_actual_mandays || 0),
        limit_mandays_snapshot:
          lg.limit_mandays_snapshot !== null ? Number(lg.limit_mandays_snapshot) : null,
        previous_progress_percent: lg.previous_progress_percent,
        new_progress_percent: lg.new_progress_percent,
        check_date: lg.check_date,
        note: lg.note,
        blocker_note: lg.blocker_note,
        logged_by: lg.logged_by,
        logged_by_name: lg.logged_by_name || null,
        created_at: lg.created_at,
      });
    }

    contract.scope_items = scopesRes.rows.map((s) => ({
      scope_item_id: s.scope_item_id,
      contract_id: s.contract_id,
      code: s.code,
      title: s.title,
      module_name: s.module_name || s.title,
      description: s.description || '',
      owner_pic: s.owner_pic || null,
      sort_order: s.sort_order,
      source: s.source,
      vat_category: s.vat_category,
      amount_before_vat: Number(s.amount_before_vat || 0),
      limit_mandays: Number(s.limit_mandays || 0),
      target_mandays: Number(s.target_mandays || 0),
      estimated_mandays: Number(s.estimated_mandays || 0),
      handover_estimated_mandays: Number(s.handover_estimated_mandays || 0),
      actual_mandays: Number(s.actual_mandays || 0),
      support_mandays: Number(s.support_mandays || 0),
      progress_percent: Number(s.progress_percent || 0),
      execution_status: s.execution_status,
      is_accepted: Boolean(s.is_accepted),
      accepted_date: s.accepted_date,
      acceptance_note: s.acceptance_note,
      pm_note: s.pm_note,
      blocker_note: s.blocker_note,
      due_date: s.due_date,
      last_check_date: s.last_check_date,
      finished_at: s.finished_at,
      bonus_payout_status: s.bonus_payout_status,
      bonus_paid_amount: Number(s.bonus_paid_amount || 0),
      bonus_disbursed_at: s.bonus_disbursed_at,
      progress_logs: logsByScope.get(s.scope_item_id) || [],
    }));

    contract.installments = instRes.rows.map((i) => ({
      installment_id: i.installment_id,
      contract_id: i.contract_id,
      code: i.code,
      label: i.label,
      trigger_type: i.trigger_type,
      sort_order: i.sort_order,
      percentage: Number(i.percentage || 0),
      non_vat_base_amount: Number(i.non_vat_base_amount || 0),
      vat_taxable_base_amount: Number(i.vat_taxable_base_amount || 0),
      vat_tax_amount: Number(i.vat_tax_amount || 0),
      amount_total: Number(i.amount_total || 0),
      vat_rate_hint: i.vat_rate_hint || 'NON_VAT',
      due_date: i.due_date,
      payment_status: i.payment_status,
      paid_date: i.paid_date,
      vat_invoice_status: i.vat_invoice_status,
      vat_invoice_number: i.vat_invoice_number,
      vat_issued_date: i.vat_issued_date,
      vat_invoice_file_url: i.vat_invoice_file_url,
      vat_invoice_file_id: i.vat_invoice_file_id,
      source_cr_id: i.source_cr_id || null,
      linked_milestone_ids: linksByInst.get(i.installment_id) || [],
    }));

    contract.change_requests = crsRes.rows.map((cr) => ({
      change_request_id: cr.change_request_id,
      contract_id: cr.contract_id,
      target_scope_item_id: cr.target_scope_item_id,
      code: cr.code,
      cr_type: cr.cr_type,
      title: cr.title,
      description: cr.description,
      requested_date: cr.requested_date,
      requested_by_client_contact: cr.requested_by_client_contact,
      dev_mandays: Number(cr.dev_mandays || 0),
      pm_estimated_mandays: Number(cr.pm_estimated_mandays || 0),
      am_allocated_to_pm_mandays: Number(cr.am_allocated_to_pm_mandays || 0),
      quoted_price_vnd: Number(cr.quoted_price_vnd || 0),
      vat_category: cr.vat_category,
      timeline_impact_days: Number(cr.timeline_impact_days || 0),
      status: cr.status,
      am_negotiation_note: cr.am_negotiation_note,
      approved_at: cr.approved_at,
    }));

    contract.am_expenses = expRes.rows.map((e) => ({
      expense_id: e.expense_id,
      contract_id: e.contract_id,
      scope_item_id: e.scope_item_id,
      code: e.code,
      expense_date: e.expense_date,
      category: e.category,
      description: e.description,
      amount_vnd: Number(e.amount_vnd || 0),
      status: e.status,
      receipt_url: e.receipt_url,
    }));

    contract.documents = docsRes.rows.map((d) => ({
      document_id: d.document_id,
      contract_id: d.contract_id,
      doc_type: d.doc_type,
      title: d.title,
      url: d.url,
      file_id: d.file_id,
      file_size: d.file_size,
      uploaded_by_name: d.uploaded_by_name || null,
      created_at: d.created_at,
    }));

    return contract;
  }

  async createWithPlanTransaction({
    contractData,
    scopeItems,
    installments,
    actorId,
  }) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      let contractCode = contractData.code?.trim()?.toUpperCase();
      if (!contractCode) {
        const seqRes = await client.query("SELECT nextval('seq_contract_code')::int AS seq");
        contractCode = `HD-2026-${String(seqRes.rows[0].seq).padStart(3, '0')}`;
      }

      const insertContractRes = await client.query(
        `
          INSERT INTO contracts (
            code, name, customer_id, owner_am_id, owner_pm_id, phase,
            signed_date, start_date, end_date, check_cycle_days,
            base_contract_value, fixed_cost_allocation, sales_commission_amount,
            risk_reserve_percent, standard_manday_rate, internal_unit_price,
            am_allocation_vnd, compression_ratio, initial_max_mandays, am_target_mandays,
            has_vat_items, has_non_vat_items, vat_rate_percent, vat_portion_amount, non_vat_portion_amount,
            invoice_method, external_accountant_note, drive_root_url,
            kickoff_checklist, handover, kpi_bonus_split_percent
          )
          VALUES (
            $1, $2, $3, $4, $5, 'PRE_PROJECT',
            $6, $7, $8, $9,
            $10, $11, $12,
            $13, $14, $15,
            $16, $17, $18, $19,
            $20, $21, $22, $23, $24,
            $25, $26, $27,
            $28::jsonb, $29::jsonb, 50
          )
          RETURNING contract_id
        `,
        [
          contractCode,
          contractData.name,
          contractData.customer_id,
          contractData.owner_am_id,
          contractData.owner_pm_id || null,
          contractData.signed_date || contractData.start_date,
          contractData.start_date,
          contractData.end_date,
          contractData.check_cycle_days || 7,
          contractData.base_contract_value,
          contractData.fixed_cost_allocation,
          contractData.sales_commission_amount,
          contractData.risk_reserve_percent,
          contractData.standard_manday_rate,
          contractData.standard_manday_rate,
          contractData.credit_y,
          contractData.compression_ratio || 1,
          contractData.initial_max_mandays,
          contractData.am_target_mandays,
          contractData.has_vat_items,
          contractData.has_non_vat_items,
          contractData.vat_rate_percent,
          contractData.vat_portion_amount,
          contractData.non_vat_portion_amount,
          contractData.invoice_method || 'BY_INSTALLMENT',
          contractData.external_accountant_note || null,
          contractData.drive_root_url || null,
          JSON.stringify(contractData.kickoff_checklist || {}),
          JSON.stringify({
            sourceCodeDelivered: false,
            userGuideAndVideoDelivered: false,
            signedAcceptanceScanUploaded: false,
          }),
        ]
      );

      const contractId = insertContractRes.rows[0].contract_id;
      const scopeTempKeyToUuid = new Map();

      for (let i = 0; i < scopeItems.length; i += 1) {
        const s = scopeItems[i];
        const scopeCode = (s.code || `M${i + 1}`).trim();
        const scopeRes = await client.query(
          `
            INSERT INTO scope_items (
              contract_id, code, title, module_name, description, owner_pic,
              sort_order, source, vat_category, amount_before_vat,
              limit_mandays, target_mandays, estimated_mandays, handover_estimated_mandays,
              due_date
            )
            VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, 'BASELINE', $8, $9,
              $10, $11, $12, $13,
              $14
            )
            RETURNING scope_item_id
          `,
          [
            contractId,
            scopeCode,
            s.title,
            s.module_name || s.title,
            s.description || '',
            s.owner_pic || null,
            i + 1,
            s.vat_category || 'NON_VAT',
            Math.round(Number(s.amount_before_vat || 0)),
            Number(s.limit_mandays || 0),
            Number(s.target_mandays || 0),
            Number(s.estimated_mandays || 0),
            Number(s.handover_estimated_mandays || 0),
            s.due_date || null,
          ]
        );
        const createdScopeId = scopeRes.rows[0].scope_item_id;
        if (s.temp_key) scopeTempKeyToUuid.set(String(s.temp_key), createdScopeId);
        scopeTempKeyToUuid.set(scopeCode, createdScopeId);
        scopeTempKeyToUuid.set(String(i), createdScopeId);
      }

      for (let i = 0; i < installments.length; i += 1) {
        const inst = installments[i];
        const instCode = (inst.code || `DOT-${i + 1}`).trim();
        const instRes = await client.query(
          `
            INSERT INTO payment_installments (
              contract_id, code, label, trigger_type, sort_order,
              percentage, non_vat_base_amount, vat_taxable_base_amount, vat_tax_amount, amount_total,
              vat_rate_hint, due_date, payment_status, vat_invoice_status
            )
            VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              $11, $12, 'PENDING', $13
            )
            RETURNING installment_id
          `,
          [
            contractId,
            instCode,
            inst.label,
            inst.trigger_type || 'MILESTONE',
            i + 1,
            Number(inst.percentage || 0),
            Number(inst.non_vat_base_amount || 0),
            Number(inst.vat_taxable_base_amount || 0),
            Number(inst.vat_tax_amount || 0),
            Number(inst.amount_total || 0),
            inst.vat_rate_hint || 'NON_VAT',
            inst.due_date || null,
            Number(inst.vat_taxable_base_amount || 0) > 0 ? 'NOT_YET' : 'NOT_REQUIRED',
          ]
        );

        const installmentId = instRes.rows[0].installment_id;
        const linkedKeys = Array.isArray(inst.linked_milestone_keys)
          ? inst.linked_milestone_keys
          : [];
        const insertedScopeSet = new Set();

        for (const key of linkedKeys) {
          const resolvedScopeId = scopeTempKeyToUuid.get(String(key));
          if (resolvedScopeId && !insertedScopeSet.has(resolvedScopeId)) {
            insertedScopeSet.add(resolvedScopeId);
            await client.query(
              `INSERT INTO installment_milestone_links (installment_id, scope_item_id) VALUES ($1, $2)`,
              [installmentId, resolvedScopeId]
            );
          }
        }
      }

      if (actorId) {
        await client.query(
          `INSERT INTO audit_logs (entity_name, entity_id, action, new_values, changed_by)
           VALUES ('contracts', $1, 'CREATE_CONTRACT', $2::jsonb, $3)`,
          [
            contractId,
            JSON.stringify({
              code: contractCode,
              name: contractData.name,
              base_contract_value: contractData.base_contract_value,
              initial_max_mandays: contractData.initial_max_mandays,
            }),
            actorId,
          ]
        );
      }

      await client.query('COMMIT');
      return this.findByIdFull(contractId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBasicConfig(contractId, patch) {
    const fields = [];
    const params = [];

    const mapCol = {
      name: 'name',
      owner_pm_id: 'owner_pm_id',
      check_cycle_days: 'check_cycle_days',
      drive_root_url: 'drive_root_url',
      drive_permissions_verified: 'drive_permissions_verified',
      bod_allow_kickoff_without_advance: 'bod_allow_kickoff_without_advance',
      quick_action_blocker: 'quick_action_blocker',
      manual_force_red_flag: 'manual_force_red_flag',
      manual_red_flag_reason: 'manual_red_flag_reason',
      external_accountant_note: 'external_accountant_note',
      fixed_cost_allocation: 'fixed_cost_allocation',
      sales_commission_amount: 'sales_commission_amount',
      risk_reserve_percent: 'risk_reserve_percent',
      standard_manday_rate: 'standard_manday_rate',
      initial_max_mandays: 'initial_max_mandays',
      am_allocation_vnd: 'am_allocation_vnd',
      base_contract_value: 'base_contract_value',
      approved_upsell_value: 'approved_upsell_value',
      vat_rate_percent: 'vat_rate_percent',
      has_vat_items: 'has_vat_items',
      has_non_vat_items: 'has_non_vat_items',
      vat_portion_amount: 'vat_portion_amount',
      non_vat_portion_amount: 'non_vat_portion_amount',
    };

    for (const [key, col] of Object.entries(mapCol)) {
      if (patch[key] !== undefined) {
        params.push(patch[key]);
        fields.push(`${col} = $${params.length}`);
        if (key === 'standard_manday_rate') {
          params.push(patch[key]);
          fields.push(`internal_unit_price = $${params.length}`);
        }
      }
    }

    if (patch.kickoff_checklist !== undefined) {
      params.push(JSON.stringify(patch.kickoff_checklist));
      fields.push(`kickoff_checklist = $${params.length}::jsonb`);
    }
    if (patch.am_custom_tags !== undefined) {
      params.push(JSON.stringify(patch.am_custom_tags));
      fields.push(`am_custom_tags = $${params.length}::jsonb`);
    }

    if (fields.length === 0) {
      return this.findByIdFull(contractId);
    }

    fields.push('updated_at = NOW()');
    params.push(contractId);

    await db.query(
      `UPDATE contracts SET ${fields.join(', ')} WHERE contract_id = $${params.length} AND deleted_at IS NULL`,
      params
    );

    if (Array.isArray(patch._installment_vat_updates) && patch._installment_vat_updates.length > 0) {
      for (const instUpd of patch._installment_vat_updates) {
        await db.query(
          `
            UPDATE payment_installments
            SET
              non_vat_base_amount = $1,
              vat_taxable_base_amount = $2,
              vat_tax_amount = $3,
              amount_total = $4,
              vat_rate_hint = $5,
              vat_invoice_status = $6,
              updated_at = NOW()
            WHERE installment_id = $7 AND deleted_at IS NULL
          `,
          [
            instUpd.non_vat_base_amount,
            instUpd.vat_taxable_base_amount,
            instUpd.vat_tax_amount,
            instUpd.amount_total,
            instUpd.vat_rate_hint,
            instUpd.vat_invoice_status,
            instUpd.installment_id,
          ]
        );
      }
    }

    return this.findByIdFull(contractId);
  }

  async addDocument({ contract_id, doc_type, title, url, file_id = null, file_size = null, uploaded_by = null }) {
    const res = await db.query(
      `
        INSERT INTO project_documents (contract_id, doc_type, title, url, file_id, file_size, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [contract_id, doc_type, title, url, file_id, file_size, uploaded_by]
    );
    return res.rows[0];
  }

  async removeDocument(contractId, documentId) {
    const res = await db.query(
      `
        UPDATE project_documents
        SET deleted_at = NOW()
        WHERE document_id = $1 AND contract_id = $2 AND deleted_at IS NULL
        RETURNING document_id
      `,
      [documentId, contractId]
    );
    return res.rows.length > 0;
  }
}

module.exports = PostgresContractRepository;
