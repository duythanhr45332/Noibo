const { z } = require('zod');
const HttpStatus = require('../../../utils/http-status');
const logger = require('../../../utils/logger');
const handleDatabaseError = require('../../../utils/db-error-handler');

const PostgresCustomerRepository = require('../../database/PostgresCustomerRepository');
const PostgresAuditLogRepository = require('../../database/PostgresAuditLogRepository');

const ListCustomers = require('../../../use_cases/customers/ListCustomers');
const GetCustomerDetail = require('../../../use_cases/customers/GetCustomerDetail');
const CreateCustomer = require('../../../use_cases/customers/CreateCustomer');
const UpdateCustomer = require('../../../use_cases/customers/UpdateCustomer');
const DeleteCustomer = require('../../../use_cases/customers/DeleteCustomer');

const customerRepository = new PostgresCustomerRepository();
const auditLogRepository = new PostgresAuditLogRepository();

const listCustomersUseCase = new ListCustomers({ customerRepository });
const getCustomerDetailUseCase = new GetCustomerDetail({ customerRepository });
const createCustomerUseCase = new CreateCustomer({ customerRepository, auditLogRepository, logger });
const updateCustomerUseCase = new UpdateCustomer({ customerRepository, auditLogRepository, logger });
const deleteCustomerUseCase = new DeleteCustomer({ customerRepository, auditLogRepository, logger });

const contactSchema = z
  .object({
    name: z.string().trim().max(150).optional().default(''),
    title: z.string().trim().max(150).optional().default(''),
    phone: z.string().trim().max(50).optional().default(''),
    email: z.string().trim().max(150).optional().default(''),
  })
  .optional();

const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
});

const createCustomerSchema = z.object({
  code: z.string().trim().max(30).optional(),
  name: z.string().trim().min(2, 'Tên doanh nghiệp tối thiểu 2 ký tự').max(255),
  tax_code: z.string().trim().max(50).nullable().optional(),
  industry: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  tech_contact: contactSchema,
  accounting_contact: contactSchema,
});

const updateCustomerSchema = createCustomerSchema.partial();

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

const CUSTOMER_CONSTRAINT_MAP = {
  ux_customers_tax_code_active: {
    field: 'tax_code',
    message: 'Mã số thuế này đã tồn tại trên hệ thống',
  },
  ux_customers_code_active: {
    field: 'code',
    message: 'Mã khách hàng đã tồn tại trên hệ thống',
  },
};

class CustomerController {
  async list(req, res, next) {
    try {
      const parsed = listCustomersQuerySchema.parse(req.query);
      const data = await listCustomersUseCase.execute({
        page: parsed.page,
        limit: parsed.limit,
        search: parsed.search,
        actorRole: req.user?.role,
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

  async options(req, res, next) {
    try {
      const items = await customerRepository.findOptions();
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

  async getById(req, res, next) {
    try {
      const data = await getCustomerDetailUseCase.execute(req.params.id, {
        actorRole: req.user?.role,
      });
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

  async create(req, res, next) {
    try {
      const payload = createCustomerSchema.parse(req.body);
      const created = await createCustomerUseCase.execute(payload, {
        actorId: req.user?.user_id || null,
      });

      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: created,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(
        handleDatabaseError(
          error,
          CUSTOMER_CONSTRAINT_MAP,
          'Không thể tạo khách hàng mới',
          logger
        )
      );
    }
  }

  async update(req, res, next) {
    try {
      const payload = updateCustomerSchema.parse(req.body);
      const updated = await updateCustomerUseCase.execute(req.params.id, payload, {
        actorId: req.user?.user_id || null,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: updated,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(
        handleDatabaseError(
          error,
          CUSTOMER_CONSTRAINT_MAP,
          'Không thể cập nhật thông tin khách hàng',
          logger
        )
      );
    }
  }

  async remove(req, res, next) {
    try {
      const data = await deleteCustomerUseCase.execute(req.params.id, {
        actorId: req.user?.user_id || null,
      });
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

module.exports = new CustomerController();
