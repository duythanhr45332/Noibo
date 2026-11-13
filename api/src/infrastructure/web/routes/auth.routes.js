const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: API Xác thực & Đăng nhập (Auth Base)
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Đăng nhập hệ thống
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả về JWT Token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Sai tên đăng nhập hoặc mật khẩu
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Lấy thông tin tài khoản hiện tại
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về thông tin người dùng đang đăng nhập
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 */
router.get('/me', authMiddleware, authController.getMe);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Đăng xuất hệ thống
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post('/logout', authMiddleware, authController.logout);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Làm mới Token phiên đăng nhập
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Trả về access token mới
 */
router.post('/refresh', authController.refresh);

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   put:
 *     summary: Đổi mật khẩu cá nhân
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - old_password
 *               - new_password
 *             properties:
 *               old_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.put('/change-password', authMiddleware, authController.changePassword);

module.exports = router;
