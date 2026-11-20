const ListUsers = require('./ListUsers');

describe('ListUsers Use Case', () => {
  it('forwards normalized filter params to userRepository.findAllPaginated', async () => {
    const mockResult = {
      items: [{ user_id: 'u1', username: 'thao.am', role: 'AM' }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    const userRepository = {
      findAllPaginated: jest.fn().mockResolvedValue(mockResult),
    };

    const useCase = new ListUsers({ userRepository });
    const result = await useCase.execute({
      page: 2,
      limit: 10,
      search: 'thao',
      role: 'AM',
      isActive: true,
    });

    expect(userRepository.findAllPaginated).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      search: 'thao',
      role: 'AM',
      isActive: true,
    });
    expect(result).toEqual(mockResult);
  });
});
