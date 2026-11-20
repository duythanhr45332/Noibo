const { z } = require('zod');
const HttpStatus = require('../../../utils/http-status');
const logger = require('../../../utils/logger');
const handleDatabaseError = require('../../../utils/db-error-handler');

const PostgresContractRepository = require('../../database/PostgresContractRepository');
const PostgresCustomerRepository = require('../../database/PostgresCustomerRepository');
const PostgresAuditLogRepository = require('../../database/PostgresAuditLogRepository');
const PostgresScopeItemRepository = require('../../database/PostgresScopeItemRepository');

const ListContracts = require('../../../use_cases/contracts/ListContracts');
const GetContractDetail = require('../../../use_cases/contracts/GetContractDetail');
const CreateContract = require('../../../use_cases/contracts/CreateContract');
const UpdateContract = require('../../../use_cases/contracts/UpdateContract');
const KickoffContract = require('../../../use_cases/contracts/KickoffContract');

const contractRepository = new PostgresContractRepository();
const customerRepository = new PostgresCustomerRepository();
const auditLogRepository = new PostgresAuditLogRepository();
const scopeItemRepository = new PostgresScopeItemRepository();

const listContractsUseCase = new ListContracts({ contractRepository });
const getContractDetailUseCase = new GetContractDetail({ contractRepository });
const createContractUseCase = new CreateContract({
  contractRepository,
  customerRepository,
  logger,
});
const updateContractUseCase = new UpdateContract({
  contractRepository,
  auditLogRepository,
  logger,
});
const kickoffContractUseCase = new KickoffContract({ scopeItemRepository });

const listContractsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional().default(''),
  phase: z
    .enum(['PRE_PROJECT', 'IN_PROJECT', 'POST_PROJECT', 'CLOSED'])
    .or(z.literal(''))
    .optional()
    .default(''),
  customer_id: z.string().uuid().optional(),
  owner_am_id: z.string().uuid().optional(),
});

const scopeItemDraftSchema = z.object({
  temp_key: z.string().optional(),
  code: z.string().trim().max(50).optional(),
  title: z.string().trim().min(1, 'Tên Mốc bàn giao không được để trống').max(255),
  module_name: z.string().trim().max(255).optional(),
  description: z.string().trim().max(2000).optional().default(''),
  owner_pic: z.string().trim().max(150).nullable().optional(),
  amount_before_vat: z.coerce.number().min(0).default(0),
  vat_category: z.enum(['NON_VAT', 'VAT_8', 'VAT_10']).default('NON_VAT'),
  limit_mandays: z.coerce.number().min(0).default(0),
  target_mandays: z.coerce.number().min(0).default(0),
  estimated_mandays: z.coerce.number().min(0).default(0),
  handover_estimated_mandays: z.coerce.number().min(0).default(0),
  due_date: z.string().nullable().optional(),
});

const installmentDraftSchema = z.object({
  code: z.string().trim().max(50).optional(),
  label: z.string().trim().min(1, 'Tên Đợt thanh toán không được để trống').max(255),
  trigger_type: z.enum(['ADVANCE', 'MILESTONE', 'ACCEPTANCE', 'OTHER']).default('MILESTONE'),
  percentage: z.coerce.number().min(0).max(100),
  due_date: z.string().nullable().optional(),
  linked_milestone_keys: z.array(z.string()).optional().default([]),
});

const createContractSchema = z.object({
  code: z.string().trim().max(50).optional(),
  name: z.string().trim().min(2, 'Tên dự án/hợp đồng tối thiểu 2 ký tự').max(255),
  customer_id: z.string().uuid('Khách hàng không hợp lệ'),
  owner_am_id: z.string().uuid().optional(),
  owner_pm_id: z.string().uuid().nullable().optional(),
  signed_date: z.string().optional(),
  start_date: z.string().min(1, 'Vui lòng chọn ngày bắt đầu'),
  end_date: z.string().min(1, 'Vui lòng chọn ngày kết thúc dự kiến'),
  check_cycle_days: z.coerce.number().int().min(1).max(30).default(7),
  fixed_cost_allocation: z.coerce.number().min(0).default(0),
  sales_commission_amount: z.coerce.number().min(0).default(0),
  risk_reserve_percent: z.coerce.number().min(0).max(100).default(25),
  standard_manday_rate: z.coerce.number().min(100000).optional(),
  compression_ratio: z.coerce.number().min(0.1).max(2).default(0.8),
  vat_rate_percent: z.coerce.number().min(0).max(100).optional(),
  invoice_method: z.enum(['BY_INSTALLMENT', 'LUMP_SUM_ON_ACCEPTANCE']).default('BY_INSTALLMENT'),
  external_accountant_note: z.string().max(2000).nullable().optional(),
  drive_root_url: z.string().max(1000).nullable().optional(),
  kickoff_checklist: z.record(z.string(), z.any()).optional(),
  scope_items: z.array(scopeItemDraftSchema).min(1, 'Cần ít nhất 1 Mốc bàn giao'),
  installments: z.array(installmentDraftSchema).optional().default([]),
});

const updateContractSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  owner_pm_id: z.string().uuid().nullable().optional(),
  check_cycle_days: z.coerce.number().int().min(1).max(30).optional(),
  drive_root_url: z.string().max(1000).nullable().optional(),
  drive_permissions_verified: z.boolean().optional(),
  bod_allow_kickoff_without_advance: z.boolean().optional(),
  quick_action_blocker: z.string().max(1000).nullable().optional(),
  manual_force_red_flag: z.boolean().optional(),
  manual_red_flag_reason: z.string().max(1000).nullable().optional(),
  external_accountant_note: z.string().max(2000).nullable().optional(),
  fixed_cost_allocation: z.coerce.number().min(0).optional(),
  sales_commission_amount: z.coerce.number().min(0).optional(),
  risk_reserve_percent: z.coerce.number().min(0).max(100).optional(),
  standard_manday_rate: z.coerce.number().min(100000).optional(),
  vat_rate_percent: z.coerce.number().min(0).max(100).optional(),
  kickoff_checklist: z.record(z.string(), z.any()).optional(),
  am_custom_tags: z.array(z.string()).optional(),
});

const addDocumentSchema = z.object({
  doc_type: z
    .enum([
      'CONTRACT',
      'CONTRACT_SCAN',
      'SCOPE_SRS',
      'CLIENT_INPUT',
      'HANDOVER',
      'ACCEPTANCE',
      'QUOTATION',
      'INVOICE',
      'DRIVE_LINK',
      'OTHER',
    ])
    .default('OTHER'),
  title: z.string().trim().min(1, 'Tên tài liệu không được để trống').max(255),
  url: z.string().trim().min(1, 'Đường dẫn tài liệu không được để trống'),
  file_id: z.string().uuid().nullable().optional(),
  file_size: z.string().max(40).nullable().optional(),
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

class ContractController {
  async list(req, res, next) {
    try {
      const parsed = listContractsQuerySchema.parse(req.query);
      const data = await listContractsUseCase.execute(
        {
          page: parsed.page,
          limit: parsed.limit,
          search: parsed.search,
          phase: parsed.phase,
          customerId: parsed.customer_id,
          ownerAmId: parsed.owner_am_id,
        },
        { actorRole: req.user?.role }
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

  async getById(req, res, next) {
    try {
      const data = await getContractDetailUseCase.execute(req.params.id, {
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
      const payload = createContractSchema.parse(req.body);
      const created = await createContractUseCase.execute(payload, {
        actorId: req.user?.user_id || null,
        actorRole: req.user?.role,
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
          {
            ux_contracts_code_active: {
              field: 'code',
              message: 'Mã hợp đồng đã tồn tại trong hệ thống',
            },
          },
          'Không thể khởi tạo hợp đồng',
          logger
        )
      );
    }
  }

  async update(req, res, next) {
    try {
      const payload = updateContractSchema.parse(req.body);
      const updated = await updateContractUseCase.execute(req.params.id, payload, {
        actorId: req.user?.user_id || null,
        actorRole: req.user?.role,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: updated,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async addDocument(req, res, next) {
    try {
      const existing = await contractRepository.findByIdFull(req.params.id);
      if (!existing) {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          data: null,
          errors: [{ field: 'id', message: 'Không tìm thấy hợp đồng' }],
          timestamp: new Date().toISOString(),
        });
      }

      const payload = addDocumentSchema.parse(req.body);
      const doc = await contractRepository.addDocument({
        contract_id: req.params.id,
        ...payload,
        uploaded_by: req.user?.user_id || null,
      });

      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: doc,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }

  async removeDocument(req, res, next) {
    try {
      const removed = await contractRepository.removeDocument(
        req.params.id,
        req.params.docId
      );
      if (!removed) {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          data: null,
          errors: [{ field: 'docId', message: 'Không tìm thấy tài liệu' }],
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        data: { document_id: req.params.docId, deleted: true },
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async kickoff(req, res, next) {
    try {
      const updated = await kickoffContractUseCase.execute(req.params.id, {
        actorId: req.user?.user_id || null,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: updated,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async addScopeItem(req, res, next) {
    try {
      const contract = await contractRepository.findByIdFull(req.params.id);
      if (!contract) {
        return res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          data: null,
          errors: [{ field: 'id', message: 'Không tìm thấy hợp đồng' }],
          timestamp: new Date().toISOString(),
        });
      }
      if (contract.phase === 'CLOSED') {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: [{ field: 'phase', message: 'Hợp đồng đã Đóng sổ (CLOSED)' }],
          timestamp: new Date().toISOString(),
        });
      }

      const payload = scopeItemDraftSchema.parse(req.body);
      if (payload.target_mandays > payload.limit_mandays) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: [{ field: 'target_mandays', message: 'Target không được vượt Limit của Mốc' }],
          timestamp: new Date().toISOString(),
        });
      }

      const currentSum = await scopeItemRepository.sumLimitsByContract(req.params.id);
      const ceiling =
        Number(contract.initial_max_mandays || 0) + Number(contract.upsell_added_mandays || 0);
      if (currentSum + payload.limit_mandays > ceiling) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: [
            {
              field: 'limit_mandays',
              message: `Tổng Limit (${currentSum + payload.limit_mandays} MD) vượt trần Credit hợp đồng (${ceiling} MD)`,
            },
          ],
          timestamp: new Date().toISOString(),
        });
      }

      const created = await scopeItemRepository.createForContract(req.params.id, payload);
      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: created,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) return formatZodError(res, error);
      next(error);
    }
  }
}

module.exports = new ContractController();
