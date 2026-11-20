require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/config/database');
const logger = require('../src/utils/logger');

const PILOT_USERS = [
  {
    username: 'bod_giamdoc',
    full_name: 'Ban Giám Đốc (BOD)',
    department: 'Ban Điều Hành',
    role: 'BOD',
    password: process.env.PILOT_DEFAULT_PASSWORD || 'Pilot@2026',
  },
  {
    username: 'ketoan_noibo',
    full_name: 'Chị Hương (Kế toán Tổng hợp)',
    department: 'Phòng Tài chính - Kế toán',
    role: 'ACCOUNTANT',
    password: process.env.PILOT_DEFAULT_PASSWORD || 'Pilot@2026',
  },
  {
    username: 'thao.am',
    full_name: 'Nguyễn Phương Thảo (AM)',
    department: 'Khối Quản trị Khách hàng (AM)',
    role: 'AM',
    password: process.env.PILOT_DEFAULT_PASSWORD || 'Pilot@2026',
  },
  {
    username: 'giang.pm',
    full_name: 'Chị Giang (PM Tổng)',
    department: 'Khối Triển khai Dự án',
    role: 'PM',
    password: process.env.PILOT_DEFAULT_PASSWORD || 'Pilot@2026',
  },
  {
    username: 'quan.pm',
    full_name: 'Minh Quân (Tech PM)',
    department: 'Khối Kỹ thuật & Tech Lead',
    role: 'PM',
    password: process.env.PILOT_DEFAULT_PASSWORD || 'Pilot@2026',
  },
];

async function ensureUser(u) {
  const existing = await db.query(
    'SELECT user_id FROM users WHERE username = $1 AND deleted_at IS NULL',
    [u.username]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].user_id;
  }
  const passwordHash = await bcrypt.hash(u.password, 10);
  const res = await db.query(
    `
      INSERT INTO users (username, password_hash, full_name, department, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING user_id
    `,
    [u.username, passwordHash, u.full_name, u.department, u.role]
  );
  return res.rows[0].user_id;
}

async function ensureCustomer(cust, actorId) {
  const existing = await db.query(
    'SELECT customer_id FROM customers WHERE code = $1 AND deleted_at IS NULL',
    [cust.code]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0].customer_id;
  }
  const res = await db.query(
    `
      INSERT INTO customers (
        code, name, tax_code, industry, address,
        tech_contact_name, tech_contact_title, tech_contact_phone, tech_contact_email,
        accounting_contact_name, accounting_contact_title, accounting_contact_phone, accounting_contact_email,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING customer_id
    `,
    [
      cust.code,
      cust.name,
      cust.tax_code,
      cust.industry,
      cust.address,
      cust.tech.name,
      cust.tech.title,
      cust.tech.phone,
      cust.tech.email,
      cust.acc.name,
      cust.acc.title,
      cust.acc.phone,
      cust.acc.email,
      actorId,
    ]
  );
  return res.rows[0].customer_id;
}

async function seedPilot() {
  logger.info('Starting Pilot Seed (Users + 2 Pilot Projects)...');

  const userIds = {};
  for (const u of PILOT_USERS) {
    userIds[u.username] = await ensureUser(u);
  }

  const vpccId = await ensureCustomer(
    {
      code: 'KH-VPCC-01',
      name: 'Văn Phòng Công Chứng Sài Gòn Center',
      tax_code: '0316688999',
      industry: 'Pháp lý & Công chứng',
      address: 'Quận 1, TP. Hồ Chí Minh',
      tech: {
        name: 'Anh Bảo (IT Lead)',
        title: 'Trưởng phòng CNTT',
        phone: '0909 112 233',
        email: 'it@vpccsaigon.vn',
      },
      acc: {
        name: 'Chị Mai (KTT)',
        title: 'Kế toán trưởng',
        phone: '0909 445 566',
        email: 'ketoan@vpccsaigon.vn',
      },
    },
    userIds['thao.am']
  );

  const logisticsId = await ensureCustomer(
    {
      code: 'KH-LOG-02',
      name: 'Công ty Cổ phần Giao nhận SmartLogistics',
      tax_code: '0317799111',
      industry: 'Logistics & Vận tải',
      address: 'TP. Thủ Đức, TP. Hồ Chí Minh',
      tech: {
        name: 'Anh Dũng (CTO)',
        title: 'Giám đốc Công nghệ',
        phone: '0918 223 344',
        email: 'cto@smartlog.vn',
      },
      acc: {
        name: 'Chị Lan (Kế toán)',
        title: 'Kế toán thanh toán',
        phone: '0918 556 677',
        email: 'ap@smartlog.vn',
      },
    },
    userIds['thao.am']
  );

  // Pilot Project 1: Văn phòng công chứng (IN_PROJECT)
  const vpccExists = await db.query(
    "SELECT contract_id FROM contracts WHERE code = 'HD-2026-VPCC-01' AND deleted_at IS NULL"
  );
  if (vpccExists.rows.length === 0) {
    const cRes = await db.query(
      `
        INSERT INTO contracts (
          code, name, customer_id, owner_am_id, owner_pm_id, phase,
          signed_date, start_date, end_date, check_cycle_days,
          base_contract_value, fixed_cost_allocation, sales_commission_amount,
          risk_reserve_percent, standard_manday_rate, internal_unit_price,
          am_allocation_vnd, compression_ratio, initial_max_mandays, am_target_mandays,
          has_vat_items, has_non_vat_items, vat_rate_percent, vat_portion_amount, non_vat_portion_amount,
          drive_permissions_verified, kickoff_checklist, am_advance_amount
        )
        VALUES (
          'HD-2026-VPCC-01', 'Phần mềm Quản lý Hồ sơ Công chứng & Ký số VPCC',
          $1, $2, $3, 'IN_PROJECT',
          '2026-10-01', '2026-10-05', '2026-12-30', 5,
          440000000, 60000000, 15000000,
          20, 2500000, 2500000,
          277000000, 0.80, 110, 88,
          true, true, 10, 110000000, 330000000,
          true,
          '{"driveRootCreated":true,"driveTeamDocCreated":true,"driveSharedDocCreated":true,"drivePermissionsGranted":true,"pmConfirmedScope":true,"kickoffTimelineConfirmed":true,"handoverEstimateConfirmed":true,"handoverEstimateMandays":4}'::jsonb,
          2000000
        )
        RETURNING contract_id
      `,
      [vpccId, userIds['thao.am'], userIds['giang.pm']]
    );
    const cid = cRes.rows[0].contract_id;

    const m1 = await db.query(
      `
        INSERT INTO scope_items (
          contract_id, code, title, module_name, owner_pic, sort_order, vat_category,
          amount_before_vat, limit_mandays, target_mandays, estimated_mandays, handover_estimated_mandays,
          actual_mandays, progress_percent, execution_status, is_accepted, accepted_date
        )
        VALUES (
          $1, 'MỐC-01', 'Phân hệ Tiếp nhận & Số hóa Hồ sơ Công chứng', 'Core VPCC', 'Chị Giang (PM Tổng)',
          1, 'NON_VAT', 220000000, 55, 44, 42, 2, 40, 100, 'COMPLETED', true, NOW()
        )
        RETURNING scope_item_id
      `,
      [cid]
    );
    const m2 = await db.query(
      `
        INSERT INTO scope_items (
          contract_id, code, title, module_name, owner_pic, sort_order, vat_category,
          amount_before_vat, limit_mandays, target_mandays, estimated_mandays, handover_estimated_mandays,
          actual_mandays, support_mandays, progress_percent, execution_status, is_accepted
        )
        VALUES (
          $1, 'MỐC-02', 'Lưu trữ Tài liệu, Ký số & Bàn giao Vận hành', 'Sign & Handover', 'Chị Giang (PM Tổng)',
          2, 'VAT_10', 200000000, 55, 44, 40, 2, 18, 0.5, 45, 'IN_PROGRESS', false
        )
        RETURNING scope_item_id
      `,
      [cid]
    );

    const d1 = await db.query(
      `
        INSERT INTO payment_installments (
          contract_id, code, label, trigger_type, sort_order, percentage,
          non_vat_base_amount, vat_taxable_base_amount, vat_tax_amount, amount_total,
          vat_rate_hint, due_date, payment_status, paid_date, vat_invoice_status
        )
        VALUES (
          $1, 'DOT-1', 'Đợt 1: Tạm ứng khởi động (40%)', 'ADVANCE', 1, 40,
          132000000, 40000000, 4000000, 176000000,
          'MIXED', '2026-10-10', 'PAID', '2026-10-08', 'ISSUED'
        )
        RETURNING installment_id
      `,
      [cid]
    );
    const d2 = await db.query(
      `
        INSERT INTO payment_installments (
          contract_id, code, label, trigger_type, sort_order, percentage,
          non_vat_base_amount, vat_taxable_base_amount, vat_tax_amount, amount_total,
          vat_rate_hint, due_date, payment_status, vat_invoice_status
        )
        VALUES (
          $1, 'DOT-2', 'Đợt 2: Nghiệm thu Mốc 1 & Mốc 2 (60%)', 'MILESTONE', 2, 60,
          198000000, 60000000, 6000000, 264000000,
          'MIXED', '2026-12-30', 'PENDING', 'SENT_TO_ACCOUNTANT'
        )
        RETURNING installment_id
      `,
      [cid]
    );

    await db.query(
      `INSERT INTO installment_milestone_links (installment_id, scope_item_id) VALUES ($1, $2), ($1, $3)`,
      [d2.rows[0].installment_id, m1.rows[0].scope_item_id, m2.rows[0].scope_item_id]
    );
  }

  // Pilot Project 2: App Logistics (PRE_PROJECT)
  const logExists = await db.query(
    "SELECT contract_id FROM contracts WHERE code = 'HD-2026-LOG-02' AND deleted_at IS NULL"
  );
  if (logExists.rows.length === 0) {
    const c2Res = await db.query(
      `
        INSERT INTO contracts (
          code, name, customer_id, owner_am_id, owner_pm_id, phase,
          signed_date, start_date, end_date, check_cycle_days,
          base_contract_value, fixed_cost_allocation, sales_commission_amount,
          risk_reserve_percent, standard_manday_rate, internal_unit_price,
          am_allocation_vnd, compression_ratio, initial_max_mandays, am_target_mandays,
          has_vat_items, has_non_vat_items, vat_rate_percent, vat_portion_amount, non_vat_portion_amount,
          drive_permissions_verified, kickoff_checklist, am_advance_amount
        )
        VALUES (
          'HD-2026-LOG-02', 'App Mobile Điều phối Tài xế & Tracking SmartLogistics',
          $1, $2, $3, 'PRE_PROJECT',
          '2026-11-10', '2026-11-20', '2027-02-28', 2,
          520000000, 70000000, 20000000,
          25, 2500000, 2500000,
          300000000, 0.80, 120, 96,
          true, true, 10, 220000000, 300000000,
          false,
          '{"driveRootCreated":true,"driveTeamDocCreated":false,"driveSharedDocCreated":false,"drivePermissionsGranted":false,"pmConfirmedScope":true,"kickoffTimelineConfirmed":false,"handoverEstimateConfirmed":true,"handoverEstimateMandays":5}'::jsonb,
          1500000
        )
        RETURNING contract_id
      `,
      [logisticsId, userIds['thao.am'], userIds['quan.pm']]
    );
    const c2Id = c2Res.rows[0].contract_id;

    const lm1 = await db.query(
      `
        INSERT INTO scope_items (
          contract_id, code, title, module_name, owner_pic, sort_order, vat_category,
          amount_before_vat, limit_mandays, target_mandays, estimated_mandays, handover_estimated_mandays
        )
        VALUES ($1, 'MỐC-01', 'App Tài xế iOS/Android & Định vị GPS', 'Driver App', 'Minh Quân (Tech PM)', 1, 'NON_VAT', 300000000, 70, 56, 52, 2)
        RETURNING scope_item_id
      `,
      [c2Id]
    );
    const lm2 = await db.query(
      `
        INSERT INTO scope_items (
          contract_id, code, title, module_name, owner_pic, sort_order, vat_category,
          amount_before_vat, limit_mandays, target_mandays, estimated_mandays, handover_estimated_mandays
        )
        VALUES ($1, 'MỐC-02', 'Web Điều phối, Đối soát POD & Bàn giao', 'Dispatch Portal', 'Minh Quân (Tech PM)', 2, 'VAT_10', 200000000, 50, 40, 38, 3)
        RETURNING scope_item_id
      `,
      [c2Id]
    );

    const ld1 = await db.query(
      `
        INSERT INTO payment_installments (
          contract_id, code, label, trigger_type, sort_order, percentage,
          non_vat_base_amount, vat_taxable_base_amount, vat_tax_amount, amount_total,
          vat_rate_hint, due_date, payment_status, vat_invoice_status
        )
        VALUES ($1, 'DOT-1', 'Đợt 1: Tạm ứng 30%', 'ADVANCE', 1, 30, 90000000, 60000000, 6000000, 156000000, 'MIXED', '2026-11-18', 'PENDING', 'NOT_YET')
        RETURNING installment_id
      `,
      [c2Id]
    );

    await db.query(
      `INSERT INTO installment_milestone_links (installment_id, scope_item_id) VALUES ($1, $2), ($1, $3)`,
      [ld1.rows[0].installment_id, lm1.rows[0].scope_item_id, lm2.rows[0].scope_item_id]
    );
  }

  logger.info('Pilot seed completed successfully (5 users + 2 customers + 2 pilot projects).');
  process.exit(0);
}

seedPilot().catch((err) => {
  logger.error('Pilot seed failed:', err);
  process.exit(1);
});
