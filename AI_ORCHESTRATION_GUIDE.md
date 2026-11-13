# HƯỚNG DẪN ĐIỀU PHỐI ĐỘI NGŨ AI AGENTS (AI ORCHESTRATION GUIDE)
**Dự án: Hệ thống Quản trị Doanh nghiệp ERP-AM**

Hệ thống AI Agent của dự án đã được cấu hình sẵn trong thư mục `.agents/`. Các quy tắc về kiến trúc (Clean Architecture, Raw SQL `pg`, Orval, Shadcn UI, Single-Company, Port `8081`/`3001`/`5433`) đã được nạp tự động vào bộ nhớ của AI thông qua file `.agents/AGENTS.md`.

---

## 1. BẢNG PHÂN CÔNG NHIỆM VỤ (THE AI SQUAD)

Dự án có các kỹ năng chuyên biệt nằm trong `.agents/skills/`:

| Tên Kỹ năng | Vai trò | Khi nào bạn cần gọi? |
| :--- | :--- | :--- |
| **`@vpcc-factory`** | **Giám đốc Sản xuất (Full-Pipeline)** | Khi bạn muốn **làm trọn gói 1 tính năng từ A-Z** (từ lúc chỉ có ý tưởng -> viết Spec -> làm DB -> làm Backend -> gen Orval -> làm Frontend -> Review). |
| **`@vpcc-pm`** | **Product Manager (BA)** | Khi bạn muốn phân tích nghiệp vụ và viết tài liệu đặc tả (Spec) trước khi code. |
| **`@vpcc-architect`** | **System Architect** | Khi tính năng phức tạp cần thiết kế bảng Database (ERD), đánh Index và chốt hợp đồng API Swagger. |
| **`@vpcc-backend`** | **Backend Developer** | Khi bạn chỉ muốn sửa hoặc thêm API, viết Migration SQL, Use Case, và chạy Jest Unit Test (`/api`). |
| **`@vpcc-frontend`** | **Frontend Developer** | Khi bạn chỉ muốn làm giao diện Next.js, sửa Form, bảng biểu, tích hợp Orval hooks (`/web`). |
| **`@vpcc-reviewer`** | **QA / Code Reviewer** | Khi code xong và bạn muốn kiểm tra lỗi bảo mật (SQL Injection, RBAC), chạy `npm test` và `tsc --noEmit`. |

---

## 2. CỔNG CỐ ĐỊNH TRONG DỰ ÁN (PORT ALLOCATION)

- **Database PostgreSQL (`erp_am_postgres`):** Host Port `5433` -> Container `5432` (DB: `erp_am_db`)
- **Backend API (`/api`):** `http://localhost:8081` (Swagger: `http://localhost:8081/api-docs`)
- **Frontend Web (`/web`):** `http://localhost:3001`
- **Production Docker (`docker-compose.deploy.yml`):** API `5092`, Web `5093`
- **Develop Docker (`docker-compose.develop.yml`):** API `5094`, Web `5095`
