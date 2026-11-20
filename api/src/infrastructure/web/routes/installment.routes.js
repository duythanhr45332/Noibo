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
 *   name: Installments
 *   description: Hàng đợi Kế toán, Xuất Hóa đơn VAT (PDF) & Xác nhận PAID (Mở khóa thưởng 50%)
 */

/**
 * @swagger
 * /api/v1/installments/queue:
 *   get:
 *     summary: Hàng đợi Phiếu Kế toán VAT & Công nợ phải thu
 *     tags: [Installments]
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
 *         name: status_filter
 *         schema:
 *           type: string
 *           enum: [VAT_QUEUE, OVERDUE, UNPAID]
 *     responses:
 *       200:
 *         description: Danh sách đợt thanh toán
 */
router.get(
  '/queue',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.ACCOUNTANT, ROLES.AM),
  sprint3Controller.listInstallmentQueue
);

/**
 * @swagger
 * /api/v1/installments/{id}/vat:
 *   patch:
 *     summary: Gửi phiếu Kế toán (AM) hoặc Xuất Hóa đơn VAT ISSUED kèm PDF (Kế toán/BOD/Admin)
 *     tags: [Installments]
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
 *             $ref: '#/components/schemas/UpdateInstallmentVatRequest'
 *     responses:
 *       200:
 *         description: Đã cập nhật trạng thái VAT
 */
router.patch(
  '/:id/vat',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.ACCOUNTANT, ROLES.AM),
  validateUuidParam('id'),
  sprint3Controller.updateInstallmentVat
);

/**
 * @swagger
 * /api/v1/installments/{id}/pay:
 *   patch:
 *     summary: Kế toán/BOD xác nhận Đã thu tiền PAID và tự động mở khóa chi thưởng 50%
 *     tags: [Installments]
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
 *         description: Đã xác nhận PAID
 */
router.patch(
  '/:id/pay',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.ACCOUNTANT, ROLES.AM),
  validateUuidParam('id'),
  sprint3Controller.markInstallmentPaid
);

module.exports = router;
