const { z } = require('zod');
const HttpStatus = require('../../../utils/http-status');
const PostgresAuditLogRepository = require('../../database/PostgresAuditLogRepository');
const ListAuditLogs = require('../../../use_cases/audit_logs/ListAuditLogs');

const auditLogRepository = new PostgresAuditLogRepository();
const listAuditLogsUseCase = new ListAuditLogs({ auditLogRepository });

const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  entity_name: z.string().optional().default(''),
  action: z.string().optional().default(''),
  changed_by: z.string().uuid().or(z.literal('')).optional().default(''),
  from_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng từ ngày phải là YYYY-MM-DD')
    .or(z.literal(''))
    .optional()
    .default(''),
  to_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Định dạng đến ngày phải là YYYY-MM-DD')
    .or(z.literal(''))
    .optional()
    .default(''),
});

class AuditLogController {
  async list(req, res, next) {
    try {
      const parsed = listAuditLogsQuerySchema.parse(req.query);
      const data = await listAuditLogsUseCase.execute(parsed);
      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: error.issues.map((i) => ({
            field: i.path.join('.') || 'general',
            message: i.message,
          })),
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  }
}

module.exports = new AuditLogController();
