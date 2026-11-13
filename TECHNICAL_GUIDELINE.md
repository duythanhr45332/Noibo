# TÀI LIỆU HƯỚNG DẪN KỸ THUẬT & QUY TẮC PHÁT TRIỂN (TECHNICAL GUIDELINE)
**Dự án: Hệ thống Quản trị Doanh nghiệp ERP-AM (Single-Company)**

Tài liệu này là **"Kim chỉ nam" (Single Source of Truth)** cho toàn bộ đội ngũ kỹ thuật và các AI Agents khi tham gia phát triển dự án. Mọi đoạn code được viết ra bắt buộc phải tuân thủ nghiêm ngặt các quy tắc dưới đây để đảm bảo tính đồng nhất, bảo mật và khả năng mở rộng.

---

## 1. TỔNG QUAN KIẾN TRÚC & CÔNG NGHỆ (TECH STACK)

Hệ thống được chia làm 3 thành phần độc lập trong cùng một Monorepo (chạy song song với dự án khác trên dải port riêng):
- **Database (`docker-compose.yml`):** PostgreSQL 15 (`erp_am_postgres`, DB `erp_am_db`, Host Port `5433` -> Container `5432`).
- **Backend (`/api`):** Node.js (v20+), Express.js (v5), Clean Architecture (Use Cases, Domain, Infrastructure), Raw SQL (`pg` Pool - Không dùng ORM nặng nề), Swagger (OpenAPI 3.0), Jest (Unit Test). Chạy ở Port **`8081`**.
- **Frontend (`/web`):** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Shadcn UI, Orval (Auto-generate API Client), TanStack Query (React Query v5), React Hook Form + Zod. Chạy ở Port **`3001`**.

---

## 2. QUY TẮC VÀNG (THE GOLDEN RULES - BẮT BUỘC TUÂN THỦ)

### 2.1. Tuyệt đối không tự viết code gọi API ở Frontend
- **CẤM:** Tự viết `axios.get('/api/v1/...')`, `fetch(...)` hoặc tự định nghĩa `interface User {...}` thủ công trong thư mục `/web` cho các API nghiệp vụ.
- **BẮT BUỘC:** Mọi thay đổi về API phải bắt đầu từ việc cập nhật JSDoc `@swagger` ở Backend -> Chạy lệnh xuất `swagger.json` (`cd api && npm run gen:swagger`) -> Chạy lệnh `cd web && npm run gen-api` (Orval) ở Frontend để tự động sinh ra React Query Hooks (`useGet...`, `usePost...`) và TypeScript Interfaces trong `web/lib/api/`.

### 2.2. Tuyệt đối không nối chuỗi SQL (SQL Injection Prevention)
- **CẤM:** Dùng Template Literals để cộng chuỗi trực tiếp biến của người dùng vào câu lệnh SQL (VD: ``SELECT * FROM users WHERE name = '${name}'``).
- **BẮT BUỘC:** Luôn sử dụng Parameterized Queries (`$1, $2, $3...`) với mảng tham số đi kèm khi gọi `pool.query(sql, params)`.

### 2.3. Giao dịch toàn vẹn (Database Transactions)
- **BẮT BUỘC:** Khi một thao tác nghiệp vụ (Use Case) cần `INSERT`, `UPDATE`, hoặc `DELETE` trên **từ 2 bảng trở lên** (hoặc cần khóa dòng bằng `FOR UPDATE`), bắt buộc phải mượn `client` từ Pool và bọc trong khối `BEGIN` ... `COMMIT` / `ROLLBACK`, sau đó `client.release()` trong khối `finally`.

### 2.4. Chuẩn hóa Phản hồi API (Standard API Response Envelope)
Mọi API trả về từ Backend (dù thành công hay thất bại) đều phải tuân theo cấu trúc JSON chuẩn:
```json
{
  "success": true,
  "data": { ... },
  "errors": [],
  "timestamp": "2026-10-27T10:00:00.000Z"
}
```
Khi có lỗi Validation (Zod), mảng `errors` trả về dạng `[{ "field": "username", "message": "Tên đăng nhập đã tồn tại" }]` để Frontend map thẳng lỗi vào ô Input tương ứng.

---

## 3. QUY TRÌNH 5 BƯỚC PHÁT TRIỂN TÍNH NĂNG MỚI (STANDARD WORKFLOW)

Khi nhận yêu cầu làm một tính năng mới, bắt buộc thực hiện tuần tự từ Dưới lên Trên (Bottom-Up):

### Bước 1: Database Migration (`/api/migrations`)
1. Tạo file migration mới bằng `node-pg-migrate`.
2. Định nghĩa bảng, khóa ngoại (`REFERENCES`), và đặc biệt chú ý đánh **Index** cho các cột dùng để tìm kiếm/lọc.
3. Chạy lệnh áp dụng vào DB:
   ```bash
   cd api && npm run migrate
   ```

### Bước 2: Backend Clean Architecture (`/api/src`)
1. **Domain Layer (`/domain`):** Định nghĩa Entity hoặc Repository Interface.
2. **Infrastructure Database (`/infrastructure/database`):** Viết class `Postgres[Module]Repository.js` thực thi câu lệnh SQL thuần.
3. **Application Layer (`/use_cases`):** Viết class `[Action][Module].js`.
   - Kiểm tra logic nghiệp vụ.
   - Ghi nhận **Audit Log** (`auditLogRepository.create(...)`) đối với các thao tác thêm/sửa/xóa quan trọng.
   - Viết **Unit Test** (`[Action][Module].test.js`) dùng Jest mock Repository và chạy `cd api && npm test` xanh (PASS 100%).
4. **Web Layer (`/infrastructure/web`):**
   - Viết Controller nhận `req`, validate dữ liệu đầu vào bằng **Zod**, gọi Use Case và trả về `res.status(...).json(...)`.
   - Khai báo Route trong `/routes`, gắn Middleware bảo mật (`authMiddleware`, `permissionMiddleware('module', 'action')`).
   - **QUAN TRỌNG:** Viết đầy đủ chú thích `@swagger` ngay trên đầu mỗi Route và khai báo Schema trong `/api/src/config/swagger.js`.

### Bước 3: Đồng bộ Hợp đồng API (Contract Sync - Swagger & Orval)
Sau khi xong Backend, đứng tại thư mục gốc chạy 2 lệnh sau để nối dây sang Frontend:
```bash
# 1. Xuất file swagger.json mới nhất từ Backend
cd api && npm run gen:swagger

# 2. Dùng Orval đọc swagger.json để sinh Hooks & Types cho Frontend
cd ../web && npm run gen-api
```

### Bước 4: Xây dựng Giao diện Frontend (`/web`)
1. Mở thư mục `web/lib/api/generated/` để kiểm tra các Hook vừa được Orval sinh ra.
2. Xây dựng trang trong `web/app/[module]/page.tsx` hoặc Component trong `web/components/features/[module]/`.
3. **Quy tắc UI/UX:**
   - Bọc trang trong `<ErpLayout>`.
   - Sử dụng các component có sẵn trong `web/components/ui/` (Shadcn UI).
   - Bảng dữ liệu có phân trang dùng `<StandardPagination />`.
   - Khi Submit Form (Mutation) thành công: Hiển thị thông báo `toast.success(...)` (thư viện `sonner`), đóng Modal, và gọi `queryClient.invalidateQueries(...)` để bảng tự động làm mới dữ liệu.

### Bước 5: Kiểm tra Chất lượng (Verification)
Trước khi bàn giao tính năng, chạy các lệnh kiểm tra:
```bash
# Kiểm tra Unit Test Backend
cd api && npm test

# Kiểm tra lỗi TypeScript Frontend
cd ../web && npm run typecheck
```
