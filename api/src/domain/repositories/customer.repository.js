class CustomerRepository {
  async findAllPaginated(_filters) {
    throw new Error('Method not implemented: findAllPaginated');
  }

  async findOptions() {
    throw new Error('Method not implemented: findOptions');
  }

  async findById(_customerId) {
    throw new Error('Method not implemented: findById');
  }

  async create(_customerData) {
    throw new Error('Method not implemented: create');
  }

  async update(_customerId, _customerData) {
    throw new Error('Method not implemented: update');
  }

  async softDelete(_customerId) {
    throw new Error('Method not implemented: softDelete');
  }
}

module.exports = CustomerRepository;
