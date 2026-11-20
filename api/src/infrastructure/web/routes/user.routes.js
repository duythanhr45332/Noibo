const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const validateUuidParam = require('../middlewares/validate-uuid.middleware');
const { ROLES } = require('../../../domain/constants/roles');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Quản trị tài khoản người dùng & Phân quyền RBAC
 */

/**
 * @swagger
 * /api/v1/users/options:
 *   get:
 *     summary: Lấy danh sách tài khoản đang hoạt động cho dropdown chọn AM/PM
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, BOD, ACCOUNTANT, AM, PM]
 *         description: Lọc theo vai trò (ví dụ AM hoặc PM)
 *     responses:
 *       200:
 *         description: Danh sách rút gọn người dùng đang hoạt động
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserOptionsResponse'
 */
router.get('/options', authMiddleware, userController.options);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Danh sách tài khoản có phân trang & bộ lọc
 *     tags: [Users]
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
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, BOD, ACCOUNTANT, AM, PM]
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *     responses:
 *       200:
 *         description: Danh sách tài khoản và thông tin phân trang
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 */
router.get(
  '/',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD),
  userController.list
);

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Tạo tài khoản người dùng mới
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: Tạo tài khoản thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserDetailResponse'
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       409:
 *         description: Tên đăng nhập đã tồn tại
 */
router.post(
  '/',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD),
  userController.create
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     summary: Cập nhật thông tin tài khoản, vai trò hoặc đặt lại mật khẩu
 *     tags: [Users]
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
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserDetailResponse'
 */
router.put(
  '/:id',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD),
  validateUuidParam('id'),
  userController.update
);

/**
 * @swagger
 * /api/v1/users/{id}/status:
 *   patch:
 *     summary: Khóa hoặc mở khóa tài khoản người dùng (tự động thu hồi refresh token khi khóa)
 *     tags: [Users]
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
 *             $ref: '#/components/schemas/ToggleUserStatusRequest'
 *     responses:
 *       200:
 *         description: Đã cập nhật trạng thái tài khoản
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserDetailResponse'
 */
router.patch(
  '/:id/status',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD),
  validateUuidParam('id'),
  userController.toggleStatus
);

module.exports = router;
