const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const { ROLES } = require('../../domain/constants/roles');

class UpdateScopeItem {
  constructor({ scopeItemRepository, auditLogRepository, logger }) {
    this.scopeItemRepository = scopeItemRepository;
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async execute(scopeItemId, payload, { actorId = null, actorRole = null } = {}) {
    const existing = await this.scopeItemRepository.findByIdWithContract(scopeItemId);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy Mốc bàn giao', 'scopeItemId');
    }

    if (existing.contract_phase === 'CLOSED') {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Hợp đồng đã Đóng sổ (CLOSED)', 'phase');
    }

    const isBodOrAdmin = actorRole === ROLES.ADMIN || actorRole === ROLES.BOD;
    const isAm = actorRole === ROLES.AM;
    const isPm = actorRole === ROLES.PM;

    if (!isBodOrAdmin && !isAm && !isPm) {
      throw new ApiError(HttpStatus.FORBIDDEN, 'Vai trò hiện tại không có quyền sửa Mốc', 'auth');
    }

    // RBAC theo trường
    if (isPm) {
      const pmForbidden = [
        'limit_mandays',
        'target_mandays',
        'amount_before_vat',
        'vat_category',
        'title',
        'owner_pic',
      ].filter((k) => payload[k] !== undefined);
      if (pmForbidden.length > 0) {
        throw new ApiError(
          HttpStatus.FORBIDDEN,
          `PM không được sửa trường tài chính/hạn mức (${pmForbidden.join(', ')})`,
          pmForbidden[0]
        );
      }
    }

    if (isAm && payload.limit_mandays !== undefined) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'Chỉ Ban Giám Đốc / Admin mới có quyền chỉnh Limit Mandays của Mốc',
        'limit_mandays'
      );
    }

    const nextLimit =
      payload.limit_mandays !== undefined
        ? Number(payload.limit_mandays)
        : Number(existing.limit_mandays || 0);
    const nextTarget =
      payload.target_mandays !== undefined
        ? Number(payload.target_mandays)
        : Number(existing.target_mandays || 0);

    if (nextTarget > nextLimit) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        `Target (${nextTarget} MD) không được vượt Limit (${nextLimit} MD)`,
        'target_mandays'
      );
    }

    if (payload.limit_mandays !== undefined) {
      const otherSum = await this.scopeItemRepository.sumLimitsByContract(
        existing.contract_id,
        scopeItemId
      );
      const contractCeiling =
        Number(existing.initial_max_mandays || 0) + Number(existing.upsell_added_mandays || 0);
      if (otherSum + nextLimit > contractCeiling) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          `Tổng Limit các Mốc (${otherSum + nextLimit} MD) vượt trần Credit hợp đồng (${contractCeiling} MD)`,
          'limit_mandays'
        );
      }
    }

    if (
      payload.handover_estimated_mandays !== undefined &&
      Number(payload.handover_estimated_mandays) < 0
    ) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'Ước tính Bàn giao (BG) không được âm',
        'handover_estimated_mandays'
      );
    }

    const updated = await this.scopeItemRepository.updateFields(scopeItemId, payload);

    if (this.auditLogRepository) {
      try {
        await this.auditLogRepository.create({
          entity_name: 'scope_items',
          entity_id: scopeItemId,
          action: 'UPDATE_SCOPE_ITEM',
          old_values: {
            limit_mandays: existing.limit_mandays,
            target_mandays: existing.target_mandays,
            estimated_mandays: existing.estimated_mandays,
            handover_estimated_mandays: existing.handover_estimated_mandays,
          },
          new_values: payload,
          changed_by: actorId,
        });
      } catch (err) {
        if (this.logger) this.logger.warn('AuditLog UpdateScopeItem failed:', err);
      }
    }

    return updated;
  }
}

module.exports = UpdateScopeItem;
