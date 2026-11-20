const ListCustomers = require('./ListCustomers');
const GetCustomerDetail = require('./GetCustomerDetail');
const CreateCustomer = require('./CreateCustomer');
const UpdateCustomer = require('./UpdateCustomer');

describe('Customer Use Cases', () => {
  it('ListCustomers strips total_contract_value when actorRole is PM', async () => {
    const customerRepository = {
      findAllPaginated: jest.fn().mockResolvedValue({
        items: [{ customer_id: 'c1', name: 'ABC', total_contract_value: 500000000 }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    };
    const uc = new ListCustomers({ customerRepository });
    const res = await uc.execute({ page: 1, limit: 20, actorRole: 'PM' });
    expect(res.items[0].total_contract_value).toBeNull();
  });

  it('GetCustomerDetail keeps financials for AM and strips for PM', async () => {
    const sample = {
      customer_id: 'c1',
      name: 'ABC',
      total_contract_value: 300000000,
      contracts: [{ contract_id: 'ct1', base_contract_value: 300000000, approved_upsell_value: 0 }],
    };
    const customerRepository = { findById: jest.fn().mockResolvedValue(sample) };
    const uc = new GetCustomerDetail({ customerRepository });

    const amRes = await uc.execute('c1', { actorRole: 'AM' });
    expect(amRes.total_contract_value).toBe(300000000);

    const pmRes = await uc.execute('c1', { actorRole: 'PM' });
    expect(pmRes.total_contract_value).toBeNull();
    expect(pmRes.contracts[0].base_contract_value).toBeNull();
  });

  it('CreateCustomer & UpdateCustomer record audit logs', async () => {
    const customerRepository = {
      create: jest.fn().mockResolvedValue({ customer_id: 'c1', name: 'New Corp' }),
      findById: jest.fn().mockResolvedValue({ customer_id: 'c1', name: 'New Corp' }),
      update: jest.fn().mockResolvedValue({ customer_id: 'c1', name: 'Updated Corp' }),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue({}) };

    const createUc = new CreateCustomer({ customerRepository, auditLogRepository });
    await createUc.execute({ name: 'New Corp', tax_code: '0311223344' }, { actorId: 'am-1' });
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ entity_name: 'customers', action: 'CREATE_CUSTOMER' })
    );

    const updateUc = new UpdateCustomer({ customerRepository, auditLogRepository });
    const updated = await updateUc.execute(
      'c1',
      { accounting_contact: { name: 'Chị Kế toán', email: 'kt@corp.vn' } },
      { actorId: 'am-1' }
    );
    expect(updated.name).toBe('Updated Corp');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ entity_name: 'customers', action: 'UPDATE_CUSTOMER' })
    );
  });
});
