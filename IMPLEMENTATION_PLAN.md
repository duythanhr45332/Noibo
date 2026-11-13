# KẾ HOẠCH TRIỂN KHAI HỆ THỐNG ERP-AM (IMPLEMENTATION PLAN)

## Giai đoạn 1: Khởi tạo Nền tảng Lõi (Core Base Setup - Đã hoàn tất)
- [x] Kiến trúc Monorepo chuẩn hóa: `api/` (Backend Clean Architecture) + `web/` (Frontend Next.js 16 + Shadcn UI + Orval).
- [x] Cấu hình Single-Company (loại bỏ hoàn toàn Multi-tenant `offices`/`office_id`).
- [x] Tách biệt hoàn toàn dải Port (`5433` DB, `8081` API, `3001` Web, `5092-5095` Docker Deploy/Develop) để chạy song song với dự án VPCC.
- [x] Baseline Migration (`0000000000001_init-core-base.js`) gồm 7 bảng nền tảng: `roles`, `permissions`, `role_permissions`, `users`, `refresh_tokens`, `audit_logs`, `notifications`.
- [x] Phân hệ Xác thực (IAM), Quản lý Nhân sự (`/hr`), Quản lý Nhóm quyền & Ma trận Phân quyền RBAC (`/settings/roles`), Thông báo thời gian thực (SSE `/api/v1/notifications/stream`), Hồ sơ cá nhân (`/profile`).

## Giai đoạn 2: Brainstorm & Phát triển Các Phân hệ Nghiệp vụ ERP-AM (Tiếp theo)
- [ ] Brainstorm bối cảnh nghiệp vụ (Domain Context) và danh sách các phân hệ cốt lõi của ERP-AM.
- [ ] Thiết kế Database Schema (ERD) & RBAC Permissions cho các phân hệ nghiệp vụ.
- [ ] Xây dựng API Backend, sinh Orval Hooks và phát triển giao diện Frontend theo quy trình 5 bước chuẩn.
