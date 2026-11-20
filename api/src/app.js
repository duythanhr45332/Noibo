const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
let morgan;
try {
  morgan = require('morgan');
} catch {
  morgan = () => (req, res, next) => next();
}
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const db = require('./config/database');
const logger = require('./utils/logger');
const HttpStatus = require('./utils/http-status');
const { apiGeneralRateLimiter } = require('./infrastructure/web/middlewares/rate-limit.middleware');

// Routes
const authRoutes = require('./infrastructure/web/routes/auth.routes');
const userRoutes = require('./infrastructure/web/routes/user.routes');
const roleRoutes = require('./infrastructure/web/routes/role.routes');
const customerRoutes = require('./infrastructure/web/routes/customer.routes');
const fileRoutes = require('./infrastructure/web/routes/file.routes');
const contractRoutes = require('./infrastructure/web/routes/contract.routes');
const scopeItemRoutes = require('./infrastructure/web/routes/scope-item.routes');
const changeRequestRoutes = require('./infrastructure/web/routes/change-request.routes');
const installmentRoutes = require('./infrastructure/web/routes/installment.routes');
const amExpenseRoutes = require('./infrastructure/web/routes/am-expense.routes');
const dashboardRoutes = require('./infrastructure/web/routes/dashboard.routes');
const auditLogRoutes = require('./infrastructure/web/routes/audit-log.routes');

const app = express();

// Trust proxy when running behind Nginx / Docker
app.set('trust proxy', 1);

// Security & Parsing Middlewares
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3001', 'http://127.0.0.1:3001'];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === 'production' || Boolean(process.env.ALLOWED_ORIGINS)) {
        return callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health Check Endpoint
app.get('/api/v1/health', async (req, res) => {
  try {
    const dbCheck = await db.query('SELECT NOW()');
    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'ERP-AM Backend Service is healthy',
      timestamp: dbCheck.rows[0].now,
    });
  } catch (error) {
    logger.error('Database healthcheck failed:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }
});

// Global API Rate Limiter (chống flood / DoS nhẹ, bỏ qua /health)
app.use('/api/v1', apiGeneralRateLimiter);

// Mount API v1 Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/files', fileRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/scope-items', scopeItemRoutes);
app.use('/api/v1/change-requests', changeRequestRoutes);
app.use('/api/v1/installments', installmentRoutes);
app.use('/api/v1/am-expenses', amExpenseRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/audit-logs', auditLogRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    data: null,
    errors: [
      {
        field: 'path',
        message: `Endpoint không tồn tại: ${req.method} ${req.originalUrl}`,
      },
    ],
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled Error:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  const statusCode =
    err.statusCode || err.status || HttpStatus.INTERNAL_SERVER_ERROR;

  if (Array.isArray(err.errors) && err.errors.length > 0) {
    return res.status(statusCode).json({
      success: false,
      data: null,
      errors: err.errors,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Lỗi hệ thống nội bộ, vui lòng thử lại sau.',
    },
    errors: [
      {
        field: err.field || 'general',
        message: err.message || 'Lỗi hệ thống nội bộ, vui lòng thử lại sau.',
      },
    ],
    timestamp: new Date().toISOString(),
  });
});

module.exports = app;
