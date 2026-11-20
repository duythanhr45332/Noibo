exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    -- =========================================================================
    -- 1. Customers: 2 Contacts (Tech & Accounting) + Unique Tax Code Index
    -- =========================================================================
    ALTER TABLE customers
      ADD COLUMN IF NOT EXISTS tech_contact_name VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS tech_contact_title VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS tech_contact_phone VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS tech_contact_email VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS accounting_contact_name VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS accounting_contact_title VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS accounting_contact_phone VARCHAR(50) NULL,
      ADD COLUMN IF NOT EXISTS accounting_contact_email VARCHAR(150) NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS ux_customers_tax_code_active
      ON customers (tax_code)
      WHERE deleted_at IS NULL AND tax_code IS NOT NULL AND tax_code <> '';

    -- =========================================================================
    -- 2. Uploaded Files Metadata (for /api/v1/files + Multer storage)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS uploaded_files (
      file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NULL REFERENCES contracts(contract_id) ON DELETE SET NULL,
      scope_item_id UUID NULL REFERENCES scope_items(scope_item_id) ON DELETE SET NULL,
      installment_id UUID NULL REFERENCES payment_installments(installment_id) ON DELETE SET NULL,
      original_name VARCHAR(255) NOT NULL,
      stored_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_size BIGINT NOT NULL CHECK (file_size >= 0),
      storage_path TEXT NOT NULL,
      category VARCHAR(40) NOT NULL DEFAULT 'OTHER',
      uploaded_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );

    CREATE INDEX IF NOT EXISTS idx_uploaded_files_contract
      ON uploaded_files (contract_id)
      WHERE deleted_at IS NULL;

    -- =========================================================================
    -- 3. Contracts Financial Config & Server-Computed Credit Alignment
    -- =========================================================================
    ALTER TABLE contracts
      ADD COLUMN IF NOT EXISTS signed_date DATE NULL,
      ADD COLUMN IF NOT EXISTS base_contract_value BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS approved_upsell_value BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS fixed_cost_allocation BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sales_commission_amount BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS standard_manday_rate BIGINT NOT NULL DEFAULT 2500000,
      ADD COLUMN IF NOT EXISTS initial_max_mandays NUMERIC(8,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS upsell_added_mandays NUMERIC(8,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS has_vat_items BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS has_non_vat_items BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS vat_rate_percent INT NOT NULL DEFAULT 10,
      ADD COLUMN IF NOT EXISTS vat_portion_amount BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS non_vat_portion_amount BIGINT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS invoice_method VARCHAR(40) NOT NULL DEFAULT 'BY_INSTALLMENT',
      ADD COLUMN IF NOT EXISTS external_accountant_note TEXT NULL;

    -- =========================================================================
    -- 4. Scope Items, Progress Logs, Payment Installments, CR, Expenses, Docs
    -- =========================================================================
    ALTER TABLE scope_items
      ADD COLUMN IF NOT EXISTS module_name VARCHAR(255) NULL,
      ADD COLUMN IF NOT EXISTS owner_pic VARCHAR(150) NULL,
      ADD COLUMN IF NOT EXISTS due_date DATE NULL,
      ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ NULL,
      ADD COLUMN IF NOT EXISTS cr_id UUID NULL;

    ALTER TABLE scope_items DROP CONSTRAINT IF EXISTS scope_items_vat_category_check;
    ALTER TABLE scope_items
      ADD CONSTRAINT scope_items_vat_category_check
      CHECK (vat_category IN ('NON_VAT', 'VAT_8', 'VAT_10'));

    ALTER TABLE scope_items DROP CONSTRAINT IF EXISTS scope_items_execution_status_check;
    ALTER TABLE scope_items
      ADD CONSTRAINT scope_items_execution_status_check
      CHECK (execution_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'BLOCKED'));

    ALTER TABLE scope_progress_logs
      ADD COLUMN IF NOT EXISTS previous_actual_mandays NUMERIC(8,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS limit_mandays_snapshot NUMERIC(8,2) NULL,
      ADD COLUMN IF NOT EXISTS previous_progress_percent INT NULL,
      ADD COLUMN IF NOT EXISTS new_progress_percent INT NULL;

    ALTER TABLE scope_progress_logs DROP CONSTRAINT IF EXISTS scope_progress_logs_log_type_check;
    ALTER TABLE scope_progress_logs
      ADD CONSTRAINT scope_progress_logs_log_type_check
      CHECK (log_type IN (
        'LOG_MANDAYS',
        'PERIODIC_CHECK',
        'FINISH_MILESTONE',
        'REOPEN_MILESTONE',
        'FREE_SUPPORT',
        'UPSELL_ADD',
        'UPSELL_ADDED'
      ));

    ALTER TABLE payment_installments
      ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS vat_rate_hint VARCHAR(20) NOT NULL DEFAULT 'NON_VAT',
      ADD COLUMN IF NOT EXISTS vat_invoice_file_url TEXT NULL,
      ADD COLUMN IF NOT EXISTS vat_invoice_file_id UUID NULL REFERENCES uploaded_files(file_id) ON DELETE SET NULL;

    ALTER TABLE payment_installments DROP CONSTRAINT IF EXISTS payment_installments_payment_status_check;
    ALTER TABLE payment_installments
      ADD CONSTRAINT payment_installments_payment_status_check
      CHECK (payment_status IN ('PENDING', 'INVOICED', 'PAID', 'OVERDUE'));

    ALTER TABLE payment_installments DROP CONSTRAINT IF EXISTS payment_installments_vat_invoice_status_check;
    ALTER TABLE payment_installments
      ADD CONSTRAINT payment_installments_vat_invoice_status_check
      CHECK (vat_invoice_status IN ('NOT_REQUIRED', 'NOT_YET', 'SENT_TO_ACCOUNTANT', 'PENDING', 'ISSUED'));

    ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_vat_category_check;
    ALTER TABLE change_requests
      ADD CONSTRAINT change_requests_vat_category_check
      CHECK (vat_category IN ('NON_VAT', 'VAT_8', 'VAT_10'));

    ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_status_check;
    ALTER TABLE change_requests
      ADD CONSTRAINT change_requests_status_check
      CHECK (status IN (
        'PM_ESTIMATING',
        'AM_QUOTING',
        'PENDING_CLIENT_QUOTE',
        'APPROVED_UPSELL',
        'APPROVED_PAID',
        'APPROVED_FREE_GOODWILL',
        'REJECTED'
      ));

    ALTER TABLE am_expenses DROP CONSTRAINT IF EXISTS am_expenses_category_check;
    ALTER TABLE am_expenses
      ADD CONSTRAINT am_expenses_category_check
      CHECK (category IN ('TAXI', 'SHIP', 'SHIPPING', 'MEAL', 'HOSPITALITY', 'CLIENT_MEETING', 'PRINTING', 'GIFT', 'OTHER'));

    ALTER TABLE am_expenses DROP CONSTRAINT IF EXISTS am_expenses_status_check;
    ALTER TABLE am_expenses
      ADD CONSTRAINT am_expenses_status_check
      CHECK (status IN ('RECORDED', 'PENDING_REIMBURSE', 'SUBMITTED', 'REIMBURSED', 'REJECTED'));

    ALTER TABLE project_documents
      ADD COLUMN IF NOT EXISTS file_id UUID NULL REFERENCES uploaded_files(file_id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS file_size VARCHAR(40) NULL;

    ALTER TABLE project_documents DROP CONSTRAINT IF EXISTS project_documents_doc_type_check;
    ALTER TABLE project_documents
      ADD CONSTRAINT project_documents_doc_type_check
      CHECK (doc_type IN (
        'CONTRACT',
        'CONTRACT_SCAN',
        'SCOPE_SRS',
        'CLIENT_INPUT',
        'HANDOVER',
        'ACCEPTANCE',
        'QUOTATION',
        'INVOICE',
        'DRIVE_LINK',
        'OTHER'
      ));
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE project_documents DROP COLUMN IF EXISTS file_size;
    ALTER TABLE project_documents DROP COLUMN IF EXISTS file_id;
    ALTER TABLE payment_installments DROP COLUMN IF EXISTS vat_invoice_file_id;
    ALTER TABLE payment_installments DROP COLUMN IF EXISTS vat_invoice_file_url;
    ALTER TABLE payment_installments DROP COLUMN IF EXISTS vat_rate_hint;
    ALTER TABLE payment_installments DROP COLUMN IF EXISTS percentage;
    ALTER TABLE scope_progress_logs DROP COLUMN IF EXISTS new_progress_percent;
    ALTER TABLE scope_progress_logs DROP COLUMN IF EXISTS previous_progress_percent;
    ALTER TABLE scope_progress_logs DROP COLUMN IF EXISTS limit_mandays_snapshot;
    ALTER TABLE scope_progress_logs DROP COLUMN IF EXISTS previous_actual_mandays;
    ALTER TABLE scope_items DROP COLUMN IF EXISTS cr_id;
    ALTER TABLE scope_items DROP COLUMN IF EXISTS finished_at;
    ALTER TABLE scope_items DROP COLUMN IF EXISTS due_date;
    ALTER TABLE scope_items DROP COLUMN IF EXISTS owner_pic;
    ALTER TABLE scope_items DROP COLUMN IF EXISTS module_name;
    ALTER TABLE contracts DROP COLUMN IF EXISTS external_accountant_note;
    ALTER TABLE contracts DROP COLUMN IF EXISTS invoice_method;
    ALTER TABLE contracts DROP COLUMN IF EXISTS non_vat_portion_amount;
    ALTER TABLE contracts DROP COLUMN IF EXISTS vat_portion_amount;
    ALTER TABLE contracts DROP COLUMN IF EXISTS vat_rate_percent;
    ALTER TABLE contracts DROP COLUMN IF EXISTS has_non_vat_items;
    ALTER TABLE contracts DROP COLUMN IF EXISTS has_vat_items;
    ALTER TABLE contracts DROP COLUMN IF EXISTS upsell_added_mandays;
    ALTER TABLE contracts DROP COLUMN IF EXISTS initial_max_mandays;
    ALTER TABLE contracts DROP COLUMN IF EXISTS standard_manday_rate;
    ALTER TABLE contracts DROP COLUMN IF EXISTS sales_commission_amount;
    ALTER TABLE contracts DROP COLUMN IF EXISTS fixed_cost_allocation;
    ALTER TABLE contracts DROP COLUMN IF EXISTS approved_upsell_value;
    ALTER TABLE contracts DROP COLUMN IF EXISTS base_contract_value;
    ALTER TABLE contracts DROP COLUMN IF EXISTS signed_date;
    DROP TABLE IF EXISTS uploaded_files CASCADE;
    DROP INDEX IF EXISTS ux_customers_tax_code_active;
    ALTER TABLE customers DROP COLUMN IF EXISTS accounting_contact_email;
    ALTER TABLE customers DROP COLUMN IF EXISTS accounting_contact_phone;
    ALTER TABLE customers DROP COLUMN IF EXISTS accounting_contact_title;
    ALTER TABLE customers DROP COLUMN IF EXISTS accounting_contact_name;
    ALTER TABLE customers DROP COLUMN IF EXISTS tech_contact_email;
    ALTER TABLE customers DROP COLUMN IF EXISTS tech_contact_phone;
    ALTER TABLE customers DROP COLUMN IF EXISTS tech_contact_title;
    ALTER TABLE customers DROP COLUMN IF EXISTS tech_contact_name;
  `);
};
