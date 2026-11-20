exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    -- =========================================================================
    -- 1. Hardening Core Users & Refresh Tokens Tables
    -- =========================================================================
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS department VARCHAR(150) NULL;

    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_username_key;

    CREATE UNIQUE INDEX IF NOT EXISTS ux_users_username_active
      ON users (username)
      WHERE deleted_at IS NULL;

    UPDATE users
      SET role = 'AM'
      WHERE role NOT IN ('ADMIN', 'BOD', 'ACCOUNTANT', 'AM', 'PM');

    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS chk_users_role;

    ALTER TABLE users
      ADD CONSTRAINT chk_users_role
      CHECK (role IN ('ADMIN', 'BOD', 'ACCOUNTANT', 'AM', 'PM'));

    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
      ON refresh_tokens (user_id, expires_at)
      WHERE revoked_at IS NULL;

    -- =========================================================================
    -- 2. Auto-Code Sequences
    -- =========================================================================
    CREATE SEQUENCE IF NOT EXISTS seq_customer_code START 1;
    CREATE SEQUENCE IF NOT EXISTS seq_contract_code START 1;
    CREATE SEQUENCE IF NOT EXISTS seq_cr_code START 1;
    CREATE SEQUENCE IF NOT EXISTS seq_expense_code START 1;

    -- =========================================================================
    -- 3. Audit Logs (matches ChangePassword & User Use Cases)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      entity_name VARCHAR(60) NOT NULL,
      entity_id UUID NOT NULL,
      action VARCHAR(50) NOT NULL,
      old_values JSONB NULL,
      new_values JSONB NULL,
      changed_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
      ON audit_logs (entity_name, entity_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
      ON audit_logs (changed_by, created_at DESC);

    -- =========================================================================
    -- 4. Customers
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS customers (
      customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code VARCHAR(30) NOT NULL,
      name VARCHAR(255) NOT NULL,
      tax_code VARCHAR(50) NULL,
      industry VARCHAR(120) NULL,
      contact_name VARCHAR(150) NULL,
      contact_email VARCHAR(150) NULL,
      contact_phone VARCHAR(50) NULL,
      address TEXT NULL,
      note TEXT NULL,
      created_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_code_active
      ON customers (code)
      WHERE deleted_at IS NULL;

    -- =========================================================================
    -- 5. Contracts (Projects)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS contracts (
      contract_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
      owner_am_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
      owner_pm_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      phase VARCHAR(30) NOT NULL DEFAULT 'PRE_PROJECT'
        CHECK (phase IN ('PRE_PROJECT', 'IN_PROJECT', 'POST_PROJECT', 'CLOSED')),
      internal_unit_price BIGINT NOT NULL DEFAULT 2500000 CHECK (internal_unit_price > 0),
      am_allocation_vnd BIGINT NOT NULL DEFAULT 0 CHECK (am_allocation_vnd >= 0),
      risk_reserve_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (risk_reserve_percent >= 0 AND risk_reserve_percent <= 100),
      compression_ratio NUMERIC(6,4) NOT NULL DEFAULT 1.0000 CHECK (compression_ratio > 0),
      am_target_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (am_target_mandays >= 0),
      am_advance_amount BIGINT NOT NULL DEFAULT 0 CHECK (am_advance_amount >= 0),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      check_cycle_days INT NOT NULL DEFAULT 7 CHECK (check_cycle_days > 0),
      last_check_in_date DATE NULL,
      drive_root_url TEXT NULL,
      drive_permissions_verified BOOLEAN NOT NULL DEFAULT false,
      kickoff_checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
      bod_allow_kickoff_without_advance BOOLEAN NOT NULL DEFAULT false,
      handover JSONB NOT NULL DEFAULT '{}'::jsonb,
      kpi_bonus_split_percent NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (kpi_bonus_split_percent >= 0 AND kpi_bonus_split_percent <= 100),
      manual_force_red_flag BOOLEAN NOT NULL DEFAULT false,
      manual_red_flag_reason TEXT NULL,
      quick_action_blocker TEXT NULL,
      am_custom_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      closed_at TIMESTAMPTZ NULL,
      closed_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_contracts_code_active
      ON contracts (code)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_contracts_phase
      ON contracts (phase)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_contracts_owner_am
      ON contracts (owner_am_id)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_contracts_customer
      ON contracts (customer_id)
      WHERE deleted_at IS NULL;

    -- =========================================================================
    -- 6. Scope Items (Milestones + 4 Manday Metrics + Bonus Payout Tracking)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS scope_items (
      scope_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
      code VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      sort_order INT NOT NULL DEFAULT 1,
      source VARCHAR(30) NOT NULL DEFAULT 'BASELINE' CHECK (source IN ('BASELINE')),
      vat_category VARCHAR(20) NOT NULL DEFAULT 'NON_VAT' CHECK (vat_category IN ('NON_VAT', 'VAT_10')),
      amount_before_vat BIGINT NOT NULL DEFAULT 0 CHECK (amount_before_vat >= 0),
      limit_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (limit_mandays >= 0),
      target_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (target_mandays >= 0),
      estimated_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (estimated_mandays >= 0),
      handover_estimated_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (handover_estimated_mandays >= 0),
      actual_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (actual_mandays >= 0),
      support_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (support_mandays >= 0),
      progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
      execution_status VARCHAR(30) NOT NULL DEFAULT 'NOT_STARTED'
        CHECK (execution_status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED')),
      is_accepted BOOLEAN NOT NULL DEFAULT false,
      accepted_date TIMESTAMPTZ NULL,
      acceptance_note TEXT NULL,
      pm_note TEXT NULL,
      blocker_note TEXT NULL,
      last_check_date DATE NULL,
      bonus_payout_status VARCHAR(30) NOT NULL DEFAULT 'LOCKED'
        CHECK (bonus_payout_status IN ('LOCKED', 'ELIGIBLE', 'DISBURSED', 'CLAWBACK_PENDING')),
      bonus_paid_amount BIGINT NOT NULL DEFAULT 0 CHECK (bonus_paid_amount >= 0),
      bonus_disbursed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_scope_items_contract_code_active
      ON scope_items (contract_id, code)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_scope_items_contract
      ON scope_items (contract_id, sort_order)
      WHERE deleted_at IS NULL;

    -- =========================================================================
    -- 7. Scope Progress Logs (Append-Only Credit Ledger)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS scope_progress_logs (
      log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
      scope_item_id UUID NOT NULL REFERENCES scope_items(scope_item_id) ON DELETE CASCADE,
      log_type VARCHAR(30) NOT NULL
        CHECK (log_type IN ('LOG_MANDAYS', 'FINISH_MILESTONE', 'REOPEN_MILESTONE', 'UPSELL_ADD')),
      delta_mandays NUMERIC(8,2) NOT NULL DEFAULT 0,
      cumulative_mandays NUMERIC(8,2) NOT NULL DEFAULT 0,
      check_date DATE NOT NULL DEFAULT CURRENT_DATE,
      note TEXT NULL,
      blocker_note TEXT NULL,
      logged_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_scope_progress_logs_scope
      ON scope_progress_logs (scope_item_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_scope_progress_logs_contract
      ON scope_progress_logs (contract_id, created_at DESC);

    -- =========================================================================
    -- 8. Change Requests (UPSELL & FREE_SUPPORT)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS change_requests (
      change_request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
      target_scope_item_id UUID NULL REFERENCES scope_items(scope_item_id) ON DELETE SET NULL,
      code VARCHAR(50) NOT NULL,
      cr_type VARCHAR(30) NOT NULL CHECK (cr_type IN ('UPSELL', 'FREE_SUPPORT')),
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
      requested_by_client_contact VARCHAR(150) NULL,
      dev_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (dev_mandays >= 0),
      pm_estimated_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (pm_estimated_mandays >= 0),
      am_allocated_to_pm_mandays NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (am_allocated_to_pm_mandays >= 0),
      quoted_price_vnd BIGINT NOT NULL DEFAULT 0 CHECK (quoted_price_vnd >= 0),
      vat_category VARCHAR(20) NOT NULL DEFAULT 'NON_VAT' CHECK (vat_category IN ('NON_VAT', 'VAT_10')),
      timeline_impact_days INT NOT NULL DEFAULT 0 CHECK (timeline_impact_days >= 0),
      status VARCHAR(40) NOT NULL DEFAULT 'PM_ESTIMATING'
        CHECK (status IN ('PM_ESTIMATING', 'PENDING_CLIENT_QUOTE', 'APPROVED_PAID', 'APPROVED_FREE_GOODWILL', 'REJECTED')),
      am_negotiation_note TEXT NULL,
      created_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      approved_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_change_requests_contract_code_active
      ON change_requests (contract_id, code)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_change_requests_contract
      ON change_requests (contract_id, status)
      WHERE deleted_at IS NULL;

    -- =========================================================================
    -- 9. Payment Installments (3 VAT BIGINT columns) & Milestone Links (M:N)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS payment_installments (
      installment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
      code VARCHAR(50) NOT NULL,
      label VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(30) NOT NULL
        CHECK (trigger_type IN ('ADVANCE', 'MILESTONE', 'ACCEPTANCE', 'OTHER')),
      sort_order INT NOT NULL DEFAULT 1,
      non_vat_base_amount BIGINT NOT NULL DEFAULT 0 CHECK (non_vat_base_amount >= 0),
      vat_taxable_base_amount BIGINT NOT NULL DEFAULT 0 CHECK (vat_taxable_base_amount >= 0),
      vat_tax_amount BIGINT NOT NULL DEFAULT 0 CHECK (vat_tax_amount >= 0),
      amount_total BIGINT NOT NULL DEFAULT 0 CHECK (amount_total >= 0),
      due_date DATE NULL,
      payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PENDING', 'PAID', 'OVERDUE')),
      paid_date TIMESTAMPTZ NULL,
      vat_invoice_status VARCHAR(20) NOT NULL DEFAULT 'NOT_REQUIRED'
        CHECK (vat_invoice_status IN ('NOT_REQUIRED', 'PENDING', 'ISSUED')),
      vat_invoice_number VARCHAR(100) NULL,
      vat_issued_date TIMESTAMPTZ NULL,
      source_cr_id UUID NULL REFERENCES change_requests(change_request_id) ON DELETE SET NULL,
      note TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_payment_installments_contract_code_active
      ON payment_installments (contract_id, code)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_payment_installments_contract
      ON payment_installments (contract_id, sort_order)
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS installment_milestone_links (
      installment_id UUID NOT NULL REFERENCES payment_installments(installment_id) ON DELETE CASCADE,
      scope_item_id UUID NOT NULL REFERENCES scope_items(scope_item_id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (installment_id, scope_item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_installment_milestone_links_scope
      ON installment_milestone_links (scope_item_id);

    -- =========================================================================
    -- 10. AM Expenses (with scope_item_id FK)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS am_expenses (
      expense_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
      scope_item_id UUID NULL REFERENCES scope_items(scope_item_id) ON DELETE SET NULL,
      code VARCHAR(50) NOT NULL,
      expense_date DATE NOT NULL,
      category VARCHAR(30) NOT NULL
        CHECK (category IN ('TAXI', 'MEAL', 'HOSPITALITY', 'GIFT', 'OTHER')),
      description TEXT NOT NULL,
      amount_vnd BIGINT NOT NULL CHECK (amount_vnd > 0),
      status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN ('SUBMITTED', 'REIMBURSED', 'REJECTED')),
      receipt_url TEXT NULL,
      created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
      reimbursed_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      reimbursed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS ux_am_expenses_code_active
      ON am_expenses (code)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_am_expenses_contract_status
      ON am_expenses (contract_id, status)
      WHERE deleted_at IS NULL;

    -- =========================================================================
    -- 11. Project Documents
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS project_documents (
      document_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
      scope_item_id UUID NULL REFERENCES scope_items(scope_item_id) ON DELETE SET NULL,
      doc_type VARCHAR(40) NOT NULL
        CHECK (doc_type IN ('CONTRACT', 'HANDOVER', 'ACCEPTANCE', 'QUOTATION', 'INVOICE', 'DRIVE_LINK', 'OTHER')),
      title VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      uploaded_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );

    CREATE INDEX IF NOT EXISTS idx_project_documents_contract
      ON project_documents (contract_id)
      WHERE deleted_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS project_documents CASCADE;
    DROP TABLE IF EXISTS am_expenses CASCADE;
    DROP TABLE IF EXISTS installment_milestone_links CASCADE;
    DROP TABLE IF EXISTS payment_installments CASCADE;
    DROP TABLE IF EXISTS change_requests CASCADE;
    DROP TABLE IF EXISTS scope_progress_logs CASCADE;
    DROP TABLE IF EXISTS scope_items CASCADE;
    DROP TABLE IF EXISTS contracts CASCADE;
    DROP TABLE IF EXISTS customers CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP SEQUENCE IF EXISTS seq_expense_code;
    DROP SEQUENCE IF EXISTS seq_cr_code;
    DROP SEQUENCE IF EXISTS seq_contract_code;
    DROP SEQUENCE IF EXISTS seq_customer_code;
    DROP INDEX IF EXISTS idx_refresh_tokens_active;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_role;
    DROP INDEX IF EXISTS ux_users_username_active;
    ALTER TABLE users DROP COLUMN IF EXISTS department;
  `);
};
