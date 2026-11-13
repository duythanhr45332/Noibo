const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ERP-AM Backend API',
      version: '1.0.0',
      description: 'Tài liệu API Hệ thống ERP-AM (Base Auth)',
    },
    servers: [
      {
        url: 'http://localhost:8081',
        description: 'Local Development Server (Port 8081)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Thao tác thành công' },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            user_id: { type: 'string', format: 'uuid' },
            username: { type: 'string', example: 'admin_root' },
            full_name: {
              type: 'string',
              example: 'Quản trị viên Hệ thống (Root)',
            },
            role: { type: 'string', example: 'ADMIN' },
            is_active: { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: { type: 'string', example: 'admin_root' },
            password: { type: 'string', example: 'Admin123@' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                access_token: { type: 'string' },
                refreshToken: { type: 'string' },
                refresh_token: { type: 'string' },
                token_type: { type: 'string', example: 'Bearer' },
                expires_in: { type: 'integer', example: 28800 },
                user: { $ref: '#/components/schemas/UserProfile' },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/infrastructure/web/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
