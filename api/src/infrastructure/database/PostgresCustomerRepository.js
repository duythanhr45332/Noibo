const db = require('../../config/database');
const CustomerRepository = require('../../domain/repositories/customer.repository');

function mapCustomerRow(row) {
  if (!row) return null;
  return {
    customer_id: row.customer_id,
    code: row.code,
    name: row.name,
    tax_code: row.tax_code,
    industry: row.industry,
    address: row.address,
    note: row.note,
    tech_contact: {
      name: row.tech_contact_name || row.contact_name || '',
      title: row.tech_contact_title || '',
      phone: row.tech_contact_phone || row.contact_phone || '',
      email: row.tech_contact_email || row.contact_email || '',
    },
    accounting_contact: {
      name: row.accounting_contact_name || '',
      title: row.accounting_contact_title || '',
      phone: row.accounting_contact_phone || '',
      email: row.accounting_contact_email || '',
    },
    contract_count: Number(row.contract_count || 0),
    total_contract_value:
      row.total_contract_value !== undefined ? Number(row.total_contract_value || 0) : 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

class PostgresCustomerRepository extends CustomerRepository {
  async findAllPaginated({ page = 1, limit = 20, search = '' } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions = ['c.deleted_at IS NULL'];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(
        c.name ILIKE $${params.length}
        OR c.code ILIKE $${params.length}
        OR COALESCE(c.tax_code, '') ILIKE $${params.length}
        OR COALESCE(c.industry, '') ILIKE $${params.length}
        OR COALESCE(c.tech_contact_name, '') ILIKE $${params.length}
        OR COALESCE(c.tech_contact_phone, '') ILIKE $${params.length}
        OR COALESCE(c.tech_contact_email, '') ILIKE $${params.length}
        OR COALESCE(c.accounting_contact_name, '') ILIKE $${params.length}
        OR COALESCE(c.accounting_contact_phone, '') ILIKE $${params.length}
        OR COALESCE(c.accounting_contact_email, '') ILIKE $${params.length}
      )`);
    }

    const whereClause = conditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int AS total FROM customers c WHERE ${whereClause}`;
    const countRes = await db.query(countQuery, params);
    const total = countRes.rows[0]?.total || 0;

    const listParams = [...params, safeLimit, offset];
    const listQuery = `
      SELECT
        c.*,
        COUNT(ct.contract_id)::int AS contract_count,
        COALESCE(SUM(ct.base_contract_value + ct.approved_upsell_value), 0)::bigint AS total_contract_value
      FROM customers c
      LEFT JOIN contracts ct
        ON ct.customer_id = c.customer_id
        AND ct.deleted_at IS NULL
      WHERE ${whereClause}
      GROUP BY c.customer_id
      ORDER BY c.created_at DESC, c.name ASC
      LIMIT $${listParams.length - 1}
      OFFSET $${listParams.length}
    `;

    const listRes = await db.query(listQuery, listParams);
    const items = listRes.rows.map(mapCustomerRow);
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

  async findOptions() {
    const query = `
      SELECT customer_id, code, name, tax_code
      FROM customers
      WHERE deleted_at IS NULL
      ORDER BY name ASC
    `;
    const res = await db.query(query);
    return res.rows;
  }

  async findById(customerId) {
    const query = `
      SELECT
        c.*,
        COUNT(ct.contract_id)::int AS contract_count,
        COALESCE(SUM(ct.base_contract_value + ct.approved_upsell_value), 0)::bigint AS total_contract_value
      FROM customers c
      LEFT JOIN contracts ct
        ON ct.customer_id = c.customer_id
        AND ct.deleted_at IS NULL
      WHERE c.customer_id = $1 AND c.deleted_at IS NULL
      GROUP BY c.customer_id
    `;
    const result = await db.query(query, [customerId]);
    if (result.rows.length === 0) return null;

    const customer = mapCustomerRow(result.rows[0]);

    const contractsRes = await db.query(
      `
        SELECT
          ct.contract_id,
          ct.code,
          ct.name,
          ct.phase,
          ct.start_date,
          ct.end_date,
          ct.base_contract_value,
          ct.approved_upsell_value,
          u_am.full_name AS am_name,
          u_pm.full_name AS pm_name
        FROM contracts ct
        LEFT JOIN users u_am ON u_am.user_id = ct.owner_am_id
        LEFT JOIN users u_pm ON u_pm.user_id = ct.owner_pm_id
        WHERE ct.customer_id = $1 AND ct.deleted_at IS NULL
        ORDER BY ct.created_at DESC
      `,
      [customerId]
    );

    customer.contracts = contractsRes.rows.map((r) => ({
      contract_id: r.contract_id,
      code: r.code,
      name: r.name,
      phase: r.phase,
      start_date: r.start_date,
      end_date: r.end_date,
      base_contract_value: Number(r.base_contract_value || 0),
      approved_upsell_value: Number(r.approved_upsell_value || 0),
      am_name: r.am_name || null,
      pm_name: r.pm_name || null,
    }));

    return customer;
  }

  async create(data) {
    const seqRes = await db.query("SELECT nextval('seq_customer_code')::int AS seq");
    const generatedCode =
      data.code && data.code.trim()
        ? data.code.trim().toUpperCase()
        : `KH-${String(seqRes.rows[0].seq).padStart(4, '0')}`;

    const query = `
      INSERT INTO customers (
        code,
        name,
        tax_code,
        industry,
        address,
        note,
        contact_name,
        contact_email,
        contact_phone,
        tech_contact_name,
        tech_contact_title,
        tech_contact_phone,
        tech_contact_email,
        accounting_contact_name,
        accounting_contact_title,
        accounting_contact_phone,
        accounting_contact_email,
        created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18
      )
      RETURNING *
    `;

    const tech = data.tech_contact || {};
    const acc = data.accounting_contact || {};

    const result = await db.query(query, [
      generatedCode,
      data.name,
      data.tax_code || null,
      data.industry || null,
      data.address || null,
      data.note || null,
      tech.name || null,
      tech.email || null,
      tech.phone || null,
      tech.name || null,
      tech.title || null,
      tech.phone || null,
      tech.email || null,
      acc.name || null,
      acc.title || null,
      acc.phone || null,
      acc.email || null,
      data.created_by || null,
    ]);

    return mapCustomerRow(result.rows[0]);
  }

  async update(customerId, data) {
    const fields = [];
    const params = [];

    const assign = (col, val) => {
      if (val !== undefined) {
        params.push(val);
        fields.push(`${col} = $${params.length}`);
      }
    };

    assign('code', data.code ? data.code.trim().toUpperCase() : undefined);
    assign('name', data.name);
    assign('tax_code', data.tax_code !== undefined ? data.tax_code || null : undefined);
    assign('industry', data.industry !== undefined ? data.industry || null : undefined);
    assign('address', data.address !== undefined ? data.address || null : undefined);
    assign('note', data.note !== undefined ? data.note || null : undefined);

    if (data.tech_contact) {
      assign('tech_contact_name', data.tech_contact.name || null);
      assign('tech_contact_title', data.tech_contact.title || null);
      assign('tech_contact_phone', data.tech_contact.phone || null);
      assign('tech_contact_email', data.tech_contact.email || null);
      assign('contact_name', data.tech_contact.name || null);
      assign('contact_phone', data.tech_contact.phone || null);
      assign('contact_email', data.tech_contact.email || null);
    }

    if (data.accounting_contact) {
      assign('accounting_contact_name', data.accounting_contact.name || null);
      assign('accounting_contact_title', data.accounting_contact.title || null);
      assign('accounting_contact_phone', data.accounting_contact.phone || null);
      assign('accounting_contact_email', data.accounting_contact.email || null);
    }

    if (fields.length === 0) {
      return this.findById(customerId);
    }

    fields.push('updated_at = NOW()');
    params.push(customerId);

    const query = `
      UPDATE customers
      SET ${fields.join(', ')}
      WHERE customer_id = $${params.length} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await db.query(query, params);
    if (result.rows.length === 0) return null;
    return this.findById(customerId);
  }

  async softDelete(customerId) {
    const activeContracts = await db.query(
      'SELECT COUNT(*)::int AS total FROM contracts WHERE customer_id = $1 AND deleted_at IS NULL',
      [customerId]
    );

    if ((activeContracts.rows[0]?.total || 0) > 0) {
      const err = new Error('Không thể xóa khách hàng đang có hợp đồng hoạt động');
      err.status = 409;
      err.field = 'customerId';
      throw err;
    }

    const res = await db.query(
      `
        UPDATE customers
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE customer_id = $1 AND deleted_at IS NULL
        RETURNING customer_id
      `,
      [customerId]
    );
    return res.rows.length > 0;
  }
}

module.exports = PostgresCustomerRepository;
