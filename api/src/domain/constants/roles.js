const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  BOD: 'BOD',
  ACCOUNTANT: 'ACCOUNTANT',
  AM: 'AM',
  PM: 'PM',
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

const ROLE_DEFINITIONS = Object.freeze([
  {
    code: ROLES.ADMIN,
    name: 'Quản trị hệ thống (Admin)',
    description: 'Quản trị tài khoản, phân quyền hệ thống và cấu hình toàn cục.',
  },
  {
    code: ROLES.BOD,
    name: 'Ban Giám Đốc (BOD)',
    description: 'Phê duyệt ngoại lệ Kick-off, giám sát tổng hợp lãi/lỗ dự án và quyết toán KPI.',
  },
  {
    code: ROLES.ACCOUNTANT,
    name: 'Kế toán (Accountant)',
    description: 'Đối soát công nợ thu tiền (PAID), xuất hóa đơn VAT và hoàn ứng chi phí AM.',
  },
  {
    code: ROLES.AM,
    name: 'Account Manager (AM)',
    description: 'Quản lý khách hàng, hợp đồng, chia Limit/Target Mandays, CR và toàn bộ nghiệp vụ Kế toán (thu tiền PAID, xuất VAT, chi thưởng 50%, hoàn ứng, kiểm toán).',
  },
  {
    code: ROLES.PM,
    name: 'Project Manager (PM)',
    description: 'Ước tính Mandays, ghi nhận tiến độ ngày công định kỳ, hoàn thành/reopen mốc.',
  },
]);

function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

module.exports = {
  ROLES,
  ALL_ROLES,
  ROLE_DEFINITIONS,
  isValidRole,
};
