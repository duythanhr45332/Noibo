const CreateCustomer = require('../CreateCustomer');
const UpdateCustomer = require('../UpdateCustomer');
const DeleteCustomer = require('../DeleteCustomer');
const GetCustomerDetail = require('../GetCustomerDetail');
const ListCustomers = require('../ListCustomers');

describe('Customer CRUD Use Cases', () => {
  test('CreateCustomer trims fields and writes CREATE_CUSTOMER audit log', async () => {
    const customerRepository = {
      create: jest.fn().mockImplementation(async (data) => ({
        customer_id: 'cust-1',
        code: 'KH-0001',
        ...data,
      })),
    };
    const auditLogRepository = {
      create: jest.fn().mockResolvedValue({}),
    };

    const useCase = new CreateCustomer({ customerRepository, auditLogRepository });
    const created = await useCase.execute(
      {
        name: '  Công ty Cổ phần Alpha  ',
        tax_code: ' 0319998888 ',
        industry: 'Công nghệ',
      },
      { actorId: 'user-am-1' }
    );

    expect(created.customer_id).toBe('cust-1');
    expect(created.name).toBe('Công ty Cổ phần Alpha');
    expect(created.tax_code).toBe('0319998888');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_name: 'customers',
        entity_id: 'cust-1',
        action: 'CREATE_CUSTOMER',
        changed_by: 'user-am-1',
      })
    );
  });

  test('CreateCustomer rejects empty company name with 400', async () => {
    const useCase = new CreateCustomer({ customerRepository: {} });
    await expect(useCase.execute({ name: '   ' })).rejects.toMatchObject({
      status: 400,
      field: 'name',
    });
  });

  test('ListCustomers & GetCustomerDetail strip VND contract values for PM role', async () => {
    const sampleItem = {
      customer_id: 'cust-1',
      code: 'KH-0001',
      name: 'Alpha Corp',
      total_contract_value: 550000000,
      contracts: [
        {
          contract_id: 'ct-1',
          code: 'HD-01',
          name: 'ERP Phase 1',
          base_contract_value: 500000000,
          approved_upsell_value: 50000000,
        },
      ],
    };

    const customerRepository = {
      findAllPaginated: jest.fn().mockResolvedValue({
        items: [{ ...sampleItem }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
      findById: jest.fn().mockResolvedValue({ ...sampleItem }),
    };

    const listUseCase = new ListCustomers({ customerRepository });
    const detailUseCase = new GetCustomerDetail({ customerRepository });

    const pmList = await listUseCase.execute({ actorRole: 'PM' });
    expect(pmList.items[0].total_contract_value).toBeNull();

    const pmDetail = await detailUseCase.execute('cust-1', { actorRole: 'PM' });
    expect(pmDetail.total_contract_value).toBeNull();
    expect(pmDetail.contracts[0].base_contract_value).toBeNull();
    expect(pmDetail.contracts[0].approved_upsell_value).toBeNull();
  });

  test('UpdateCustomer updates existing customer and logs UPDATE_CUSTOMER', async () => {
    const existing = { customer_id: 'cust-1', name: 'Old Name' };
    const updated = { customer_id: 'cust-1', name: 'New Name', note: 'VIP' };
    const customerRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockResolvedValue(updated),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue({}) };

    const useCase = new UpdateCustomer({ customerRepository, auditLogRepository });
    const res = await useCase.execute(
      'cust-1',
      { name: 'New Name', note: 'VIP' },
      { actorId: 'user-am-1' }
    );

    expect(res).toEqual(updated);
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE_CUSTOMER',
        old_values: existing,
        new_values: updated,
      })
    );
  });

  test('DeleteCustomer blocks deletion with 409 when active contracts exist, and soft-deletes when 0 contracts', async () => {
    const conflictErr = new Error('Không thể xóa khách hàng đang có hợp đồng hoạt động');
    conflictErr.status = 409;

    const blockedRepo = {
      findById: jest.fn().mockResolvedValue({ customer_id: 'cust-busy' }),
      softDelete: jest.fn().mockRejectedValue(conflictErr),
    };

    const blockedUseCase = new DeleteCustomer({ customerRepository: blockedRepo });
    await expect(blockedUseCase.execute('cust-busy')).rejects.toMatchObject({
      status: 409,
    });

    const cleanRepo = {
      findById: jest.fn().mockResolvedValue({ customer_id: 'cust-free', name: 'Free Co' }),
      softDelete: jest.fn().mockResolvedValue(true),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue({}) };
    const cleanUseCase = new DeleteCustomer({
      customerRepository: cleanRepo,
      auditLogRepository,
    });

    const deleted = await cleanUseCase.execute('cust-free', { actorId: 'user-am-1' });
    expect(deleted).toEqual({ customer_id: 'cust-free', deleted: true });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE_CUSTOMER',
        entity_id: 'cust-free',
      })
    );
  });
});
