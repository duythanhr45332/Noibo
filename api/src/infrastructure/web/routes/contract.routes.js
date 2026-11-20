const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contract.controller');
const sprint3Controller = require('../controllers/sprint3.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const validateUuidParam = require('../middlewares/validate-uuid.middleware');
const { ROLES } = require('../../../domain/constants/roles');

/**
 * @swagger
 * tags:
 *   name: Contracts
 *   description: Quản trị Hợp đồng, Credit Mandays & Pre-Project Setup
 */

/**
 * @swagger
 * /api/v1/contracts:
 *   get:
 *     summary: Danh sách hợp đồng có phân trang & bộ lọc (tự động ẩn VNĐ với vai trò PM)
 *     tags: [Contracts]
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
 *         name: phase
 *         schema:
 *           type: string
 *           enum: [PRE_PROJECT, IN_PROJECT, POST_PROJECT, CLOSED]
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Danh sách hợp đồng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractListResponse'
 */
router.get('/', authMiddleware, contractController.list);

/**
 * @swagger
 * /api/v1/contracts/{id}:
 *   get:
 *     summary: Chi tiết đầy đủ Hợp đồng gồm Mốc, Đợt thanh toán, CR, Chi phí & Tài liệu
 *     tags: [Contracts]
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
 *         description: Chi tiết hợp đồng
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractDetailResponse'
 */
router.get('/:id', authMiddleware, validateUuidParam('id'), contractController.getById);

/**
 * @swagger
 * /api/v1/contracts:
 *   post:
 *     summary: Khởi tạo Hợp đồng mới kèm Mốc bàn giao & Đợt thanh toán (Server tính Credit Y & VAT 3 cột)
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateContractRequest'
 *     responses:
 *       201:
 *         description: Khởi tạo hợp đồng thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractDetailResponse'
 */
router.post(
  '/',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  contractController.create
);

/**
 * @swagger
 * /api/v1/contracts/{id}:
 *   patch:
 *     summary: Cập nhật thông tin/cấu hình hợp đồng (RBAC kiểm tra theo trường)
 *     tags: [Contracts]
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
 *             $ref: '#/components/schemas/UpdateContractRequest'
 *     responses:
 *       200:
 *         description: Cập nhật hợp đồng thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ContractDetailResponse'
 */
router.patch(
  '/:id',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM, ROLES.PM),
  validateUuidParam('id'),
  contractController.update
);

/**
 * @swagger
 * /api/v1/contracts/{id}/documents:
 *   post:
 *     summary: Gắn tài liệu vào hợp đồng
 *     tags: [Contracts]
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
 *             $ref: '#/components/schemas/AddContractDocumentRequest'
 *     responses:
 *       201:
 *         description: Đã thêm tài liệu vào hợp đồng
 */
router.post(
  '/:id/documents',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM, ROLES.PM),
  validateUuidParam('id'),
  contractController.addDocument
);

/**
 * @swagger
 * /api/v1/contracts/{id}/documents/{docId}:
 *   delete:
 *     summary: Xóa tài liệu khỏi hợp đồng
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Đã xóa tài liệu
 */
router.delete(
  '/:id/documents/:docId',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  validateUuidParam('id'),
  validateUuidParam('docId'),
  contractController.removeDocument
);

/**
 * @swagger
 * /api/v1/contracts/{id}/kickoff:
 *   post:
 *     summary: Gatekeeper #1 - Kích hoạt Start Project (PRE_PROJECT -> IN_PROJECT) sau khi kiểm tra 4/4 Checklist & Tạm ứng Đợt 1
 *     tags: [Contracts]
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
 *         description: Start Project thành công
 */
router.post(
  '/:id/kickoff',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  validateUuidParam('id'),
  contractController.kickoff
);

/**
 * @swagger
 * /api/v1/contracts/{id}/scope-items:
 *   post:
 *     summary: Thêm Mốc bàn giao mới vào hợp đồng
 *     tags: [Contracts]
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
 *             $ref: '#/components/schemas/CreateScopeItemRequest'
 *     responses:
 *       201:
 *         description: Tạo Mốc bàn giao thành công
 */
router.post(
  '/:id/scope-items',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  validateUuidParam('id'),
  contractController.addScopeItem
);

/**
 * @swagger
 * /api/v1/contracts/{id}/change-requests:
 *   post:
 *     summary: Tạo Phát sinh (UPSELL hoặc FREE_SUPPORT 1:1 <= 1 MD/mốc) gắn vào Mốc đang chạy
 *     tags: [Contracts]
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
 *             $ref: '#/components/schemas/CreateChangeRequest'
 *     responses:
 *       201:
 *         description: Tạo phát sinh thành công
 */
router.post(
  '/:id/change-requests',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM, ROLES.PM),
  validateUuidParam('id'),
  sprint3Controller.createChangeRequest
);

/**
 * @swagger
 * /api/v1/contracts/{id}/close:
 *   post:
 *     summary: Gatekeeper #2 - Quyết toán Đóng dự án (kiểm tra đủ 5 điều kiện cứng gồm 100% chi phí AM REIMBURSED)
 *     tags: [Contracts]
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
 *               kpi_bonus_split_percent:
 *                 type: number
 *                 default: 50
 *               handover:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       200:
 *         description: Đóng dự án thành công
 */
router.post(
  '/:id/close',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM),
  validateUuidParam('id'),
  sprint3Controller.closeProject
);

module.exports = router;
