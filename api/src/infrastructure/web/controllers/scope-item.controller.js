const { z } = require('zod');
const HttpStatus = require('../../../utils/http-status');
const logger = require('../../../utils/logger');
const { ROLES } = require('../../../domain/constants/roles');

const PostgresScopeItemRepository = require('../../database/PostgresScopeItemRepository');
const PostgresAuditLogRepository = require('../../database/PostgresAuditLogRepository');

const UpdateScopeItem = require('../../../use_cases/scope_items/UpdateScopeItem');
const LogScopeMandays = require('../../../use_cases/scope_items/LogScopeMandays');
const FinishMilestone = require('../../../use_cases/scope_items/FinishMilestone');
const ReopenMilestone = require('../../../use_cases/scope_items/ReopenMilestone');
const DisburseMilestoneBonus = require('../../../use_cases/scope_items/DisburseMilestoneBonus');

const scopeItemRepository = new PostgresScopeItemRepository();
const auditLogRepository = new PostgresAuditLogRepository();

const updateScopeItemUseCase = new UpdateScopeItem({
  scopeItemRepository,
  auditLogRepository,
  logger,
});
const logScopeMandaysUseCase = new LogScopeMandays({ scopeItemRepository });
const finishMilestoneUseCase = new FinishMilestone({ scopeItemRepository });
const reopenMilestoneUseCase = new ReopenMilestone({ scopeItemRepository });
const disburseMilestoneBonusUseCase = new DisburseMilestoneBonus({
  scopeItemRepository,
});

const updateScopeSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  module_name: z.string().trim().max(255).optional(),
  description: z.string().trim().max(2000).optional(),
  owner_pic: z.string().trim().max(150).nullable().optional(),
  due_date: z.string().nullable().optional(),
  amount_before_vat: z.coerce.number().min(0).optional(),
  vat_category: z.enum(['NON_VAT', 'VAT_8', 'VAT_10']).optional(),
  limit_mandays: z.coerce.number().min(0).optional(),
  target_mandays: z.coerce.number().min(0).optional(),
  estimated_mandays: z.coerce.number().min(0).optional(),
  handover_estimated_mandays: z.coerce.number().min(0).optional(),
  pm_note: z.string().max(2000).nullable().optional(),
  blocker_note: z.string().max(2000).nullable().optional(),
});

const logMandaysSchema = z.object({
  delta_mandays: z.coerce.number().optional(),
  new_cumulative_mandays: z.coerce.number().min(0).optional(),
  progress_percent: z.coerce.number().int().min(0).max(100).optional(),
  execution_status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DELAYED', 'BLOCKED']).optional(),
  check_date: z.string().optional(),
  note: z.string().max(2000).optional().default(''),
  blocker_note: z.string().max(2000).nullable().optional(),
});

const finishSchema = z.object({
  note: z.string().max(2000).optional().default(''),
});

const reopenSchema = z.object({
  reason: z.string().trim().min(2, 'Vui lòng nhập lý do mở lại Mốc (Reopen)').max(1000),
});

const disburseBonusSchema = z.object({
  note: z.string().trim().max(1000).optional().default(''),
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

class ScopeItemController {
  async update(req, res, next) {
    try {
      const payload = updateScopeSchema.parse(req.body);
      const updated = await updateScopeItemUseCase.execute(req.params.id, payload, {
        actorId: req.user?.user_id || null,
        actorRole: req.user?.role,
      });

      const responseData =
        req.user?.role === ROLES.PM ? { ...updated, amount_before_vat: null } : updated;

      return res.status(HttpStatus.OK).json({
        success: true,
        data: responseData,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async logMandays(req, res, next) {
    try {
      const payload = logMandaysSchema.parse(req.body);
      const data = await logScopeMandaysUseCase.execute(req.params.id, payload, {
        actorId: req.user?.user_id || null,
      });

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

  async finish(req, res, next) {
    try {
      const payload = finishSchema.parse(req.body || {});
      const data = await finishMilestoneUseCase.execute(req.params.id, {
        note: payload.note,
        actorId: req.user?.user_id || null,
      });

      if (req.user?.role === ROLES.PM) {
        data.bonus_vnd = null;
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

  async reopen(req, res, next) {
    try {
      const payload = reopenSchema.parse(req.body || {});
      const data = await reopenMilestoneUseCase.execute(req.params.id, {
        reason: payload.reason,
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

  async disburseBonus(req, res, next) {
    try {
      const payload = disburseBonusSchema.parse(req.body || {});
      const data = await disburseMilestoneBonusUseCase.execute(req.params.id, {
        note: payload.note,
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
}

module.exports = new ScopeItemController();
