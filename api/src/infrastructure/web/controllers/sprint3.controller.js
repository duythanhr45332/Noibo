const { z } = require('zod');
const HttpStatus = require('../../../utils/http-status');
const { ROLES } = require('../../../domain/constants/roles');
const PostgresSprint3Repository = require('../../database/PostgresSprint3Repository');

const sprint3Repo = new PostgresSprint3Repository();

const createCrSchema = z.object({
  target_scope_item_id: z.string().uuid('Vui lòng chọn Mốc bàn giao hợp lệ'),
  cr_type: z.enum(['UPSELL', 'FREE_SUPPORT']),
  title: z.string().trim().min(2, 'Tiêu đề phát sinh tối thiểu 2 ký tự').max(255),
  description: z.string().max(2000).optional().default(''),
  requested_by_client_contact: z.string().max(150).optional().default(''),
  dev_mandays: z.coerce.number().min(0).default(0),
  pm_estimated_mandays: z.coerce.number().min(0).default(0),
  am_allocated_to_pm_mandays: z.coerce.number().min(0).default(0),
  quoted_price_vnd: z.coerce.number().min(0).default(0),
  vat_category: z.enum(['NON_VAT', 'VAT_8', 'VAT_10']).default('NON_VAT'),
  timeline_impact_days: z.coerce.number().int().min(0).default(0),
  am_negotiation_note: z.string().max(2000).optional().default(''),
});

const resolveCrSchema = z.object({
  status: z
    .enum(['PM_ESTIMATING', 'AM_QUOTING', 'PENDING_CLIENT_QUOTE', 'APPROVED_UPSELL', 'REJECTED'])
    .optional(),
  pm_estimated_mandays: z.coerce.number().min(0).optional(),
  am_allocated_to_pm_mandays: z.coerce.number().min(0).optional(),
  quoted_price_vnd: z.coerce.number().min(0).optional(),
  vat_category: z.enum(['NON_VAT', 'VAT_8', 'VAT_10']).optional(),
  am_negotiation_note: z.string().max(2000).optional(),
});

const updateVatSchema = z.object({
  vat_invoice_status: z.enum(['NOT_YET', 'SENT_TO_ACCOUNTANT', 'ISSUED']),
  vat_invoice_number: z.string().trim().max(100).nullable().optional(),
  vat_invoice_file_id: z.string().uuid().nullable().optional(),
  vat_invoice_file_url: z.string().max(1000).nullable().optional(),
});

const payInstallmentSchema = z.object({
  paid_date: z.string().nullable().optional(),
});

const closeProjectSchema = z.object({
  kpi_bonus_split_percent: z.coerce.number().min(0).max(100).default(50),
  handover: z
    .object({
      sourceCodeDelivered: z.boolean().optional(),
      userGuideAndVideoDelivered: z.boolean().optional(),
      signedAcceptanceScanUploaded: z.boolean().optional(),
      acceptanceScanFileName: z.string().optional(),
    })
    .optional(),
});

const createExpenseSchema = z.object({
  contract_id: z.string().uuid('Hợp đồng không hợp lệ'),
  scope_item_id: z.string().uuid().nullable().optional(),
  expense_date: z.string().optional(),
  category: z
    .enum(['TAXI', 'SHIP', 'SHIPPING', 'MEAL', 'HOSPITALITY', 'CLIENT_MEETING', 'PRINTING', 'GIFT', 'OTHER'])
    .default('OTHER'),
  description: z.string().trim().min(2, 'Mô tả chi phí không được để trống').max(1000),
  amount_vnd: z.coerce.number().min(1000, 'Số tiền chi tối thiểu 1.000 VNĐ'),
  receipt_url: z.string().max(1000).nullable().optional(),
});

const updateExpenseStatusSchema = z.object({
  status: z.enum(['PENDING_REIMBURSE', 'REIMBURSED', 'REJECTED']),
});

function formatZodError(res, zodErr) {
  return res.status(HttpStatus.BAD_REQUEST).json({
    success: false,
    data: null,
    errors: zodErr.issues.map((i) => ({
      field: i.path.join('.') || 'general',
      message: i.message,
    })),
    timestamp: new Date().toISOString(),
  });
}

class Sprint3Controller {
  async createChangeRequest(req, res, next) {
    try {
      const payload = createCrSchema.parse(req.body);
      const data = await sprint3Repo.createChangeRequestTransaction(
        req.params.id,
        payload,
        req.user?.user_id || null
      );
      if (req.user?.role === ROLES.PM) {
        data.quoted_price_vnd = null;
      }
      return res.status(HttpStatus.CREATED).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async resolveChangeRequest(req, res, next) {
    try {
      const payload = resolveCrSchema.parse(req.body);
      if (
        (payload.status === 'APPROVED_UPSELL' || payload.quoted_price_vnd !== undefined) &&
        req.user?.role === ROLES.PM
      ) {
        return res.status(HttpStatus.FORBIDDEN).json({
          success: false,
          data: null,
          errors: [{ field: 'auth', message: 'PM không có quyền chốt giá hoặc duyệt tiền Upsell' }],
          timestamp: new Date().toISOString(),
        });
      }

      const data = await sprint3Repo.resolveChangeRequestTransaction(
        req.params.id,
        payload,
        req.user?.user_id || null
      );
      if (req.user?.role === ROLES.PM) {
        data.quoted_price_vnd = null;
      }
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async listInstallmentQueue(req, res, next) {
    try {
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const statusFilter = typeof req.query.status_filter === 'string' ? req.query.status_filter : '';
      const data = await sprint3Repo.listInstallmentQueue({ page, limit, statusFilter });
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async updateInstallmentVat(req, res, next) {
    try {
      const payload = updateVatSchema.parse(req.body);
      const data = await sprint3Repo.updateInstallmentVat({
        installmentId: req.params.id,
        status: payload.vat_invoice_status,
        vatInvoiceNumber: payload.vat_invoice_number,
        fileId: payload.vat_invoice_file_id,
        fileUrl: payload.vat_invoice_file_url,
        actorRole: req.user?.role,
        actorId: req.user?.user_id || null,
      });
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async markInstallmentPaid(req, res, next) {
    try {
      const payload = payInstallmentSchema.parse(req.body || {});
      const data = await sprint3Repo.markInstallmentPaidTransaction(req.params.id, {
        paidDate: payload.paid_date || null,
        actorId: req.user?.user_id || null,
      });
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async closeProject(req, res, next) {
    try {
      const payload = closeProjectSchema.parse(req.body || {});
      const data = await sprint3Repo.closeProjectTransaction(req.params.id, {
        kpiBonusSplitPercent: payload.kpi_bonus_split_percent,
        handover: payload.handover || null,
        actorId: req.user?.user_id || null,
      });
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async listExpenses(req, res, next) {
    try {
      const data = await sprint3Repo.listAmExpenses({
        page: Number(req.query.page || 1),
        limit: Number(req.query.limit || 20),
        contractId: typeof req.query.contract_id === 'string' ? req.query.contract_id : '',
        status: typeof req.query.status === 'string' ? req.query.status : '',
      });
      if (req.user?.role === ROLES.PM) {
        data.items = data.items.map((item) => ({ ...item, amount_vnd: null }));
      }
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async createExpense(req, res, next) {
    try {
      const payload = createExpenseSchema.parse(req.body);
      const data = await sprint3Repo.createAmExpense(payload, req.user?.user_id);
      return res.status(HttpStatus.CREATED).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async updateExpenseStatus(req, res, next) {
    try {
      const payload = updateExpenseStatusSchema.parse(req.body);
      const data = await sprint3Repo.updateAmExpenseStatus(
        req.params.id,
        payload.status,
        req.user?.user_id || null
      );
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async dashboardSummary(req, res, next) {
    try {
      const data = await sprint3Repo.getDashboardSummary();
      if (req.user?.role === ROLES.PM) {
        data.contracts.total_portfolio_value = null;
        data.financials = null;
        data.am_expenses = null;
      }
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new Sprint3Controller();
