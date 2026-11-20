const express = require('express');
const router = express.Router();
const scopeItemController = require('../controllers/scope-item.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const validateUuidParam = require('../middlewares/validate-uuid.middleware');
const { ROLES } = require('../../../domain/constants/roles');

/**
 * @swagger
 * tags:
 *   name: ScopeItems
 *   description: Quản lý Mốc bàn giao, Log Mandays định kỳ, Finish 50/50 & Reopen Mốc
 */

/**
 * @swagger
 * /api/v1/scope-items/{id}:
 *   patch:
 *     summary: Cập nhật Mốc bàn giao theo phân quyền từng trường (BOD sửa Limit, AM sửa Target, PM sửa Estimate/BG)
 *     tags: [ScopeItems]
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
 *             $ref: '#/components/schemas/UpdateScopeItemRequest'
 *     responses:
 *       200:
 *         description: Cập nhật Mốc thành công
 */
router.patch(
  '/:id',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM, ROLES.PM),
  validateUuidParam('id'),
  scopeItemController.update
);

/**
 * @swagger
 * /api/v1/scope-items/{id}/logs:
 *   post:
 *     summary: Log Mandays định kỳ (chỉ cộng vào actual_mandays Real, khóa PRE_PROJECT/CLOSED)
 *     tags: [ScopeItems]
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
 *             $ref: '#/components/schemas/LogMandaysRequest'
 *     responses:
 *       201:
 *         description: Đã ghi nhận ngày công
 */
router.post(
  '/:id/logs',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM, ROLES.PM),
  validateUuidParam('id'),
  scopeItemController.logMandays
);

/**
 * @swagger
 * /api/v1/scope-items/{id}/finish:
 *   post:
 *     summary: Chốt Finish Mốc bàn giao (tính dôi dư 50/50, tách AT_LIMIT hòa vốn, mở thưởng nếu đợt PAID)
 *     tags: [ScopeItems]
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Finish Mốc thành công
 */
router.post(
  '/:id/finish',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM, ROLES.PM),
  validateUuidParam('id'),
  scopeItemController.finish
);

/**
 * @swagger
 * /api/v1/scope-items/{id}/reopen:
 *   post:
 *     summary: Mở lại Mốc trước khi CLOSED (ghi log REOPEN_MILESTONE, chuyển POST_PROJECT -> IN_PROJECT)
 *     tags: [ScopeItems]
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
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đã Reopen Mốc
 */
router.post(
  '/:id/reopen',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  validateUuidParam('id'),
  scopeItemController.reopen
);

/**
 * @swagger
 * /api/v1/scope-items/{id}/disburse-bonus:
 *   post:
 *     summary: Kế toán/BOD/Admin xác nhận Đã thực chi thưởng 50% (ELIGIBLE -> DISBURSED)
 *     tags: [ScopeItems]
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DisburseBonusRequest'
 *     responses:
 *       200:
 *         description: Đã xác nhận thực chi thưởng 50%
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DisburseBonusResponse'
 */
router.post(
  '/:id/disburse-bonus',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.ACCOUNTANT, ROLES.AM),
  validateUuidParam('id'),
  scopeItemController.disburseBonus
);

module.exports = router;
