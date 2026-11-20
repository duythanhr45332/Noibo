const { z } = require('zod');
const HttpStatus = require('../../../utils/http-status');
const logger = require('../../../utils/logger');
const handleDatabaseError = require('../../../utils/db-error-handler');
const { ALL_ROLES } = require('../../../domain/constants/roles');

const PostgresUserRepository = require('../../database/PostgresUserRepository');
const PostgresAuditLogRepository = require('../../database/PostgresAuditLogRepository');

const ListUsers = require('../../../use_cases/users/ListUsers');
const GetActiveUsersDropdown = require('../../../use_cases/users/GetActiveUsersDropdown');
const CreateUser = require('../../../use_cases/users/CreateUser');
const UpdateUser = require('../../../use_cases/users/UpdateUser');
const ToggleUserStatus = require('../../../use_cases/users/ToggleUserStatus');

const userRepository = new PostgresUserRepository();
const auditLogRepository = new PostgresAuditLogRepository();

const listUsersUseCase = new ListUsers({ userRepository });
const getActiveUsersDropdownUseCase = new GetActiveUsersDropdown({ userRepository });
const createUserUseCase = new CreateUser({ userRepository, auditLogRepository, logger });
const updateUserUseCase = new UpdateUser({ userRepository, auditLogRepository, logger });
const toggleUserStatusUseCase = new ToggleUserStatus({
  userRepository,
  auditLogRepository,
  logger,
});

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  role: z.enum(ALL_ROLES).or(z.literal('')).optional().default(''),
  is_active: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : null)),
});

const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Tên đăng nhập tối thiểu 3 ký tự')
    .max(50, 'Tên đăng nhập tối đa 50 ký tự')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Tên đăng nhập chỉ chứa chữ cái, số, dấu chấm, gạch dưới, gạch nối'),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(100, 'Mật khẩu tối đa 100 ký tự'),
  full_name: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(150, 'Họ tên tối đa 150 ký tự'),
  department: z.string().trim().max(150, 'Phòng ban tối đa 150 ký tự').nullable().optional(),
  role: z.enum(ALL_ROLES, { message: 'Vai trò phải thuộc ADMIN, BOD, ACCOUNTANT, AM hoặc PM' }),
  is_active: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  full_name: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(150).optional(),
  department: z.string().trim().max(150).nullable().optional(),
  role: z.enum(ALL_ROLES, { message: 'Vai trò không hợp lệ' }).optional(),
  new_password: z
    .string()
    .min(6, 'Mật khẩu đặt lại tối thiểu 6 ký tự')
    .max(100)
    .optional()
    .or(z.literal('')),
});

const toggleStatusSchema = z.object({
  is_active: z.boolean({ message: 'Trạng thái kích hoạt phải là boolean' }),
});

function formatZodError(res, zodErr) {
  return res.status(HttpStatus.BAD_REQUEST).json({
    success: false,
    data: null,
    errors: zodErr.issues.map((issue) => ({
      field: issue.path.join('.') || 'general',
      message: issue.message,
    })),
    timestamp: new Date().toISOString(),
  });
}

class UserController {
  async list(req, res, next) {
    try {
      const parsed = listUsersQuerySchema.parse(req.query);
      const data = await listUsersUseCase.execute({
        page: parsed.page,
        limit: parsed.limit,
        search: parsed.search,
        role: parsed.role,
        isActive: parsed.is_active,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return formatZodError(res, error);
      }
      next(error);
    }
  }

  async options(req, res, next) {
    try {
      const roleParam = typeof req.query.role === 'string' ? req.query.role.trim() : '';
      if (roleParam && !ALL_ROLES.includes(roleParam)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: [{ field: 'role', message: 'Vai trò lọc không hợp lệ' }],
          timestamp: new Date().toISOString(),
        });
      }

      const items = await getActiveUsersDropdownUseCase.execute({ role: roleParam });
      return res.status(HttpStatus.OK).json({
        success: true,
        data: items,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const payload = createUserSchema.parse(req.body);
      const created = await createUserUseCase.execute({
        ...payload,
        actorId: req.user?.user_id || null,
      });

      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: created,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return formatZodError(res, error);
      }
      const mapped = handleDatabaseError(
        error,
        {
          ux_users_username_active: {
            field: 'username',
            message: 'Tên đăng nhập đã tồn tại trong hệ thống',
          },
        },
        'Không thể tạo tài khoản người dùng',
        logger
      );
      next(mapped);
    }
  }

  async update(req, res, next) {
    try {
      const payload = updateUserSchema.parse(req.body);
      const updated = await updateUserUseCase.execute(req.params.id, {
        ...payload,
        actorId: req.user?.user_id || null,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: updated,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return formatZodError(res, error);
      }
      next(error);
    }
  }

  async toggleStatus(req, res, next) {
    try {
      const payload = toggleStatusSchema.parse(req.body);
      const updated = await toggleUserStatusUseCase.execute(req.params.id, {
        is_active: payload.is_active,
        actorId: req.user?.user_id || null,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: updated,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return formatZodError(res, error);
      }
      next(error);
    }
  }
}

module.exports = new UserController();
