const fs = require('fs');
const path = require('path');
const { z } = require('zod');
const HttpStatus = require('../../../utils/http-status');
const ApiError = require('../../../utils/api-error');
const { ROLES } = require('../../../domain/constants/roles');
const PostgresFileRepository = require('../../database/PostgresFileRepository');
const { UPLOAD_DIR } = require('../middlewares/upload.middleware');

const fileRepository = new PostgresFileRepository();

const uploadMetaSchema = z.object({
  contract_id: z.string().uuid().optional().nullable(),
  scope_item_id: z.string().uuid().optional().nullable(),
  installment_id: z.string().uuid().optional().nullable(),
  category: z
    .enum([
      'CONTRACT_SCAN',
      'SCOPE_SRS',
      'CLIENT_INPUT',
      'HANDOVER',
      'ACCEPTANCE',
      'INVOICE',
      'OTHER',
    ])
    .optional()
    .default('OTHER'),
});

class FileController {
  async upload(req, res, next) {
    try {
      if (!req.file) {
        throw new ApiError(HttpStatus.BAD_REQUEST, 'Vui lòng chọn tệp để tải lên', 'file');
      }

      const meta = uploadMetaSchema.parse({
        contract_id: req.body?.contract_id || null,
        scope_item_id: req.body?.scope_item_id || null,
        installment_id: req.body?.installment_id || null,
        category: req.body?.category || 'OTHER',
      });

      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

      const saved = await fileRepository.create({
        contract_id: meta.contract_id,
        scope_item_id: meta.scope_item_id,
        installment_id: meta.installment_id,
        original_name: originalName,
        stored_name: req.file.filename,
        mime_type: req.file.mimetype,
        file_size: req.file.size,
        storage_path: path.resolve(req.file.path),
        category: meta.category,
        uploaded_by: req.user?.user_id || null,
      });

      return res.status(HttpStatus.CREATED).json({
        success: true,
        data: {
          file_id: saved.file_id,
          original_name: saved.original_name,
          mime_type: saved.mime_type,
          file_size: Number(saved.file_size),
          category: saved.category,
          contract_id: saved.contract_id,
          url: `/api/v1/files/${saved.file_id}`,
          created_at: saved.created_at,
        },
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlink(req.file.path, () => {});
      }
      if (error instanceof z.ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: error.issues.map((i) => ({
            field: i.path.join('.') || 'file',
            message: i.message,
          })),
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  }

  async downloadOrPreview(req, res, next) {
    try {
      const fileRecord = await fileRepository.findById(req.params.id);
      if (!fileRecord) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy tệp đính kèm', 'id');
      }

      if (fileRecord.contract_id && fileRecord.contract_deleted_at) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Hợp đồng liên kết không còn tồn tại', 'id');
      }

      // PM không được mở file hóa đơn VAT hoặc hợp đồng tài chính nhạy cảm
      if (
        req.user?.role === ROLES.PM &&
        (fileRecord.category === 'INVOICE' || fileRecord.category === 'CONTRACT_SCAN')
      ) {
        throw new ApiError(
          HttpStatus.FORBIDDEN,
          'Vai trò PM không có quyền xem chứng từ tài chính / hợp đồng',
          'auth'
        );
      }

      const safePath = path.resolve(UPLOAD_DIR, path.basename(fileRecord.stored_name));
      if (!safePath.startsWith(path.resolve(UPLOAD_DIR)) || !fs.existsSync(safePath)) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Tệp vật lý không tồn tại trên máy chủ', 'id');
      }

      const encodedName = encodeURIComponent(fileRecord.original_name);
      res.setHeader('Content-Type', fileRecord.mime_type || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodedName}`
      );
      return fs.createReadStream(safePath).pipe(res);
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const deleted = await fileRepository.softDelete(req.params.id);
      if (!deleted) {
        throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy tệp để xóa', 'id');
      }

      const safePath = path.resolve(UPLOAD_DIR, path.basename(deleted.stored_name));
      if (safePath.startsWith(path.resolve(UPLOAD_DIR)) && fs.existsSync(safePath)) {
        fs.unlink(safePath, () => {});
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        data: { file_id: deleted.file_id, deleted: true },
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FileController();
