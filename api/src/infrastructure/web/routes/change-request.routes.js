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
 *   name: ChangeRequests
 *   description: Phát sinh Hỗ trợ 0đ (1:1 <= 1 MD/mốc) và Upsell cộng thẳng Mốc
 */

/**
 * @swagger
 * /api/v1/change-requests/{id}:
 *   patch:
 *     summary: PM ước lượng / AM báo giá / BOD & AM duyệt CR Upsell (tự động cộng Limit/Target/Est vào Mốc và tạo đợt TT)
 *     tags: [ChangeRequests]
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
 *             $ref: '#/components/schemas/ResolveChangeRequest'
 *     responses:
 *       200:
 *         description: Cập nhật / duyệt CR thành công
 */
router.patch(
  '/:id',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM, ROLES.PM),
  validateUuidParam('id'),
  sprint3Controller.resolveChangeRequest
);

module.exports = router;
