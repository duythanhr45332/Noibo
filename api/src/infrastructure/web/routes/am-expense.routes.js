const express = require('express');
const router = express.Router();
const sprint3Controller = require('../controllers/sprint3.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const validateUuidParam = require('../middlewares/validate-uuid.middleware');
const { ROLES } = require('../../../domain/constants/roles');

/**
 * @swagger
 * tags:
 *   name: AmExpenses
 *   description: Sổ Tạm ứng & Hoàn ứng Công tác phí AM
 */

/**
 * @swagger
 * /api/v1/am-expenses:
 *   get:
 *     summary: Danh sách khoản chi phí AM có phân trang
 *     tags: [AmExpenses]
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
 *         name: contract_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách chi phí AM
 */
router.get('/', authMiddleware, sprint3Controller.listExpenses);

/**
 * @swagger
 * /api/v1/am-expenses:
 *   post:
 *     summary: AM tạo đề nghị hoàn ứng chi phí công tác
 *     tags: [AmExpenses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAmExpenseRequest'
 *     responses:
 *       201:
 *         description: Tạo khoản chi thành công
 */
router.post(
  '/',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  sprint3Controller.createExpense
);

/**
 * @swagger
 * /api/v1/am-expenses/{id}/status:
 *   patch:
 *     summary: Kế toán/BOD duyệt hoàn ứng (REIMBURSED) hoặc từ chối (REJECTED)
 *     tags: [AmExpenses]
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
 *             $ref: '#/components/schemas/UpdateAmExpenseStatusRequest'
 *     responses:
 *       200:
 *         description: Cập nhật trạng thái hoàn ứng thành công
 */
router.patch(
  '/:id/status',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.ACCOUNTANT, ROLES.AM),
  validateUuidParam('id'),
  sprint3Controller.updateExpenseStatus
);

module.exports = router;
