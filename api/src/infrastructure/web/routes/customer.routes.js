const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const validateUuidParam = require('../middlewares/validate-uuid.middleware');
const { ROLES } = require('../../../domain/constants/roles');

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Quản lý Danh bạ Khách hàng & 2 Đầu mối (Kỹ thuật / Kế toán)
 */

/**
 * @swagger
 * /api/v1/customers/options:
 *   get:
 *     summary: Lấy danh sách khách hàng rút gọn cho dropdown
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách khách hàng rút gọn
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerOptionsResponse'
 */
router.get('/options', authMiddleware, customerController.options);

/**
 * @swagger
 * /api/v1/customers:
 *   get:
 *     summary: Danh sách khách hàng có phân trang & tìm kiếm
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách khách hàng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerListResponse'
 */
router.get('/', authMiddleware, customerController.list);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   get:
 *     summary: Chi tiết khách hàng kèm danh sách hợp đồng liên quan
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Chi tiết khách hàng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerDetailResponse'
 */
router.get('/:id', authMiddleware, validateUuidParam('id'), customerController.getById);

/**
 * @swagger
 * /api/v1/customers:
 *   post:
 *     summary: Tạo khách hàng mới (kiểm tra trùng MST)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCustomerRequest'
 *     responses:
 *       201:
 *         description: Tạo khách hàng thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerDetailResponse'
 */
router.post(
  '/',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  customerController.create
);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   put:
 *     summary: Cập nhật thông tin doanh nghiệp và 2 đầu mối kỹ thuật / kế toán
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCustomerRequest'
 *     responses:
 *       200:
 *         description: Cập nhật khách hàng thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CustomerDetailResponse'
 */
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  validateUuidParam('id'),
  customerController.update
);

/**
 * @swagger
 * /api/v1/customers/{id}:
 *   delete:
 *     summary: Xóa mềm khách hàng (chặn nếu đang có hợp đồng)
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Đã xóa khách hàng
 */
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  validateUuidParam('id'),
  customerController.remove
);

module.exports = router;
