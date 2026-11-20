const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const HttpStatus = require('../../../utils/http-status');
const { ROLE_DEFINITIONS } = require('../../../domain/constants/roles');

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Danh mục vai trò chuẩn RBAC
 */

/**
 * @swagger
 * /api/v1/roles:
 *   get:
 *     summary: Lấy danh sách 5 vai trò chuẩn của hệ thống
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách vai trò hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoleListResponse'
 */
router.get('/', authMiddleware, (req, res) => {
  return res.status(HttpStatus.OK).json({
    success: true,
    data: ROLE_DEFINITIONS,
    errors: [],
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
