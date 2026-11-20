const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/audit-log.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const { ROLES } = require('../../../domain/constants/roles');

/**
 * @swagger
 * tags:
 *   name: AuditLogs
 *   description: Tra cứu Nhật ký Kiểm toán hệ thống (BOD / Admin / Kế toán)
 */

/**
 * @swagger
 * /api/v1/audit-logs:
 *   get:
 *     summary: Danh sách Nhật ký Kiểm toán có bộ lọc & phân trang
 *     tags: [AuditLogs]
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
 *         name: entity_name
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: changed_by
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           example: '2026-10-01'
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           example: '2026-12-31'
 *     responses:
 *       200:
 *         description: Danh sách Nhật ký Kiểm toán kèm thống kê tổng quan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLogListResponse'
 */
router.get(
  '/',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.ACCOUNTANT, ROLES.AM),
  auditLogController.list
);

module.exports = router;
