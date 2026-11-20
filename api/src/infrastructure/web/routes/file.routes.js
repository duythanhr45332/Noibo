const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/role.middleware');
const validateUuidParam = require('../middlewares/validate-uuid.middleware');
const { uploadMiddleware } = require('../middlewares/upload.middleware');
const ApiError = require('../../../utils/api-error');
const HttpStatus = require('../../../utils/http-status');
const { ROLES } = require('../../../domain/constants/roles');

function handleSingleFileUpload(req, res, next) {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(HttpStatus.BAD_REQUEST, 'Kích thước tệp vượt quá giới hạn 15MB', 'file')
        );
      }
      return next(err);
    }
    return next();
  });
}

/**
 * @swagger
 * tags:
 *   name: Files
 *   description: Tải lên, xem trước và tải xuống tài liệu hợp đồng / BBNT / Hóa đơn VAT
 */

/**
 * @swagger
 * /api/v1/files/upload:
 *   post:
 *     summary: Tải lên tệp tài liệu (PDF, PNG, JPG, WEBP, DOCX, XLSX, tối đa 15MB)
 *     tags: [Files]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               contract_id:
 *                 type: string
 *                 format: uuid
 *               scope_item_id:
 *                 type: string
 *                 format: uuid
 *               installment_id:
 *                 type: string
 *                 format: uuid
 *               category:
 *                 type: string
 *                 enum: [CONTRACT_SCAN, SCOPE_SRS, CLIENT_INPUT, HANDOVER, ACCEPTANCE, INVOICE, OTHER]
 *     responses:
 *       201:
 *         description: Tải tệp lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UploadedFileResponse'
 */
router.post(
  '/upload',
  authMiddleware,
  handleSingleFileUpload,
  fileController.upload
);

/**
 * @swagger
 * /api/v1/files/{id}:
 *   get:
 *     summary: Xem trực tiếp (PDF/Image) hoặc tải về tệp đính kèm theo UUID
 *     tags: [Files]
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
 *         description: Luồng dữ liệu tệp
 */
router.get('/:id', authMiddleware, validateUuidParam('id'), fileController.downloadOrPreview);

/**
 * @swagger
 * /api/v1/files/{id}:
 *   delete:
 *     summary: Xóa tệp đính kèm
 *     tags: [Files]
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
 *         description: Đã xóa tệp
 */
router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles(ROLES.ADMIN, ROLES.BOD, ROLES.AM, ROLES.ACCOUNTANT),
  validateUuidParam('id'),
  fileController.remove
);

module.exports = router;
