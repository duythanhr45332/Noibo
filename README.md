# ERP-AM — Hệ thống Quản trị Hợp đồng B2B, Sổ cái Ngày công & Dòng tiền Dự án

**ERP-AM** là hệ thống quản trị hợp đồng, ngân sách ngày công (**Manday Credit Ledger**) và dòng tiền dự án phần mềm B2B (Single-Company). Hệ thống giúp doanh nghiệp kiểm soát chặt chẽ phạm vi dự án (chống *scope creep*), tách bạch quỹ ngày công sản xuất với quỹ tạm ứng công tác của Account Manager (AM), và liên kết trực tiếp tiến độ bàn giao kỹ thuật với đề nghị thanh toán & hóa đơn GTGT (VAT).

---

## 1. Tổng quan Nghiệp vụ (Business Domain)

### 1.1. Triết lý cốt lõi: Sổ cái Tín dụng Ngày công (Manday Credit Account)
Thay vì theo dõi % tiến độ task vụn vặt mang tính cảm tính, ERP-AM quản lý mỗi hợp đồng và từng mốc bàn giao như một **Tài khoản Tín dụng Ngày công (In/Out Balance)**:
- Công ty cấp một trần ngày công (`Limit`), AM giao mục tiêu thấp hơn cho PM (`Target`), PM lập dự toán kỹ thuật (`Estimate`), và đội ngũ định kỳ log số ngày công tiêu hao thực tế (`Real`).
- Mọi thao tác tiêu hao ngày công đều lưu vết kiểm toán (Audit Log: ngày giờ, người cập nhật, delta MD, lý do tiêu hao).

### 1.2. Phân vai Người dùng & Bảo mật Tài chính ("Hide Price by Default")
| Vai trò | Trách nhiệm chính | Quyền hiển thị tài chính |
| :--- | :--- | :--- |
| **BOD / Kế toán** | Cấu hình chi phí cố định, hoa hồng Sales, quỹ dự phòng rủi ro (20–30%), cấp trần `Limit Mandays`, duyệt ngoại lệ Kick-off khi chưa thu cọc, đối soát hóa đơn VAT & hoàn ứng. | Xem 100% số liệu tài chính nội bộ và hợp đồng. |
| **Account Manager (AM)** | Chủ sở hữu hợp đồng; giao `Target` cho PM; theo dõi định kỳ; duyệt Hỗ trợ 0đ hoặc báo giá Phụ lục Upsell; đôn đốc công nợ & quản lý quỹ tạm ứng công tác. | Xem giá trị hợp đồng, đơn giá Manday, doanh thu Upsell, công nợ & quỹ thưởng. |
| **Project Manager (PM) & PIC Mốc** | Lập `Estimate` (bao gồm cả thời gian bàn giao/HDSD), xác nhận hiểu Scope khi Kick-off, định kỳ log ngày công `Real` và cảnh báo blocker kỹ thuật. | **Ẩn toàn bộ giá trị tiền (VNĐ) & đơn giá Manday**, chỉ làm việc với đơn vị ngày công (`MD`). |

- **Cơ chế Hide Price by Default:** Mặc định toàn bộ giá trị tiền trên giao diện được che dưới dạng `•••••••• ₫` và chỉ hiển thị khi AM/BOD chủ động bấm biểu tượng Con mắt, giúp tránh lộ thông tin tài chính khi ngồi họp trực tiếp với khách hàng hoặc đội Dev.

### 1.3. Mô hình 4 Chỉ số Mốc bàn giao & Cơ chế Thưởng 50/50
Mỗi hợp đồng được chia thành các **Mốc bàn giao kỹ thuật (`ScopeItem`)**, mỗi mốc có **1 người phụ trách riêng (`ownerPic`)** và luôn theo dõi 4 chỉ số:
1. **`Limit` (`limitMandays`):** Hạn mức ngày công tối đa công ty cấp cho Mốc. Vượt `Limit` (`Real > Limit`) → **Báo động Đỏ (Âm quỹ)**.
2. **`Target` (`targetMandays`):** Mục tiêu AM ép tiến độ giao PM (`Target <= Limit`). Khoảng `Limit - Target` là vùng đệm an toàn do AM nắm giữ. Vượt `Target` → **Cảnh báo Vàng**.
3. **`Estimate` (`estimatedMandays`):** Dự toán kỹ thuật của PM, **bắt buộc bao gồm cả ngày công bàn giao, họp nghiệm thu, đào tạo UAT và viết HDSD (`handoverEstimatedMandays`)**.
4. **`Real` (`actualMandays`):** Ngày công tiêu hao thực tế được log định kỳ (chu kỳ 2, 5 hoặc 7 ngày).

**Cơ chế Chốt Mốc (`Finish Milestone`) & Chia thưởng 50/50:**
- Khi bấm **Finish Milestone**, hệ thống tính dôi dư: `Surplus = Limit - Real`.
- Nếu `Surplus > 0`:
  - **50%** giữ lại vào **Quỹ bù rủi ro tích lũy** để bù cho các mốc sau nếu bị âm quỹ.
  - **50%** đưa vào **Quỹ thưởng Team** (Lead/PM, Dev, Sale/AM).
- **Mở khóa thưởng theo dòng tiền (Cash-Backed Unlock):** Phần thưởng 50% của Mốc chỉ chuyển từ trạng thái `PENDING_PAYMENT` sang `UNLOCKED` khi Mốc đã Finish **VÀ** đợt thanh toán gắn với Mốc đó đã được khách hàng thanh toán (`PAID`).

### 1.4. Tách biệt Mốc bàn giao Kỹ thuật & Đợt thanh toán / Hóa đơn VAT
- **Mốc bàn giao (`ScopeItem`):** Chia theo hạng mục kỹ thuật, gắn người phụ trách (`ownerPic`) và phân loại thuế riêng từng hạng mục (`NON_VAT` cho phần mềm thiết kế riêng, `VAT_8` / `VAT_10` cho hạ tầng, đào tạo, dịch vụ).
- **Đợt thanh toán (`PaymentInstallment`):** Chia theo % dòng tiền hợp đồng và liên kết linh hoạt **`1-1`**, **`1-N`**, hoặc **`N-1`** với Mốc bàn giao (VD: phải xong cả Mốc 1 + Mốc 2 mới thu Đợt 2).
- Khi các Mốc liên kết được bấm *Finish*, hệ thống tự động đẩy đợt thanh toán tương ứng vào danh sách **Cần gửi ĐNTT thu tiền** của AM; đồng thời theo dõi song song trạng thái tiền (`PENDING` → `INVOICED` → `PAID` / `OVERDUE`) và hóa đơn đỏ (`NOT_YET` → `SENT_TO_ACCOUNTANT` → `ISSUED` kèm số hóa đơn & PDF).

### 1.5. Quản trị Phát sinh ngay trong Mốc: Hỗ trợ 0đ vs Phụ lục Upsell
- **Hỗ trợ thiện chí 0đ (`FREE_SUPPORT`):**
  - Giới hạn tối đa **1 ngày công Dev (`devMandays <= 1`)**.
  - Áp dụng quy tắc quy đổi **`1 MD Dev = 3 MD Thực tế`** (tính đủ Dev + Test + Bàn giao).
  - Khi ghi nhận, hệ thống tự động trừ vào `Real` của Mốc đang chạy và tổng hợp thành **Biên bản Bằng chứng Hỗ trợ 0đ** (có nút sao chép nhanh gửi khách) để AM làm cơ sở đàm phán phụ lục tính phí khi khách tiếp tục phát sinh.
- **Phụ lục Phát sinh tính phí (`UPSELL`):**
  - Luồng duyệt: `PM_ESTIMATING` → `AM_QUOTING` → `APPROVED_UPSELL`.
  - Khi duyệt: tự động cộng doanh thu Upsell vào hợp đồng, cộng `Limit` & `Target` trực tiếp vào Mốc đang gắn kết, và tự động sinh thêm **Đợt thanh toán** mới theo mức thuế VAT tương ứng.

### 1.6. Sổ Tạm ứng & Chi phí Công tác AM
Tách biệt hoàn toàn với Quỹ Ngày công sản xuất: theo dõi hạn mức tạm ứng (`amAdvanceAmountVnd`) và các khoản chi vận hành (`TAXI`, `SHIPPING`, `CLIENT_MEETING`, `HOSPITALITY`, `PRINTING`...) theo trạng thái `RECORDED` → `PENDING_REIMBURSE` → `REIMBURSED` để đối soát hoàn ứng với Kế toán.

### 1.7. Vòng đời 4 Giai đoạn, 2 Gatekeepers & Đèn Sức khỏe
```
PRE_PROJECT ──[Gatekeeper #1]──> IN_PROJECT ──[Finish 100% Mốc]──> POST_PROJECT ──[Gatekeeper #2]──> CLOSED
```
- **Gatekeeper #1 (Kick-off):** (1) Đã thu Tạm ứng Đợt 1 (`PAID`) **hoặc** BOD duyệt ngoại lệ, **VÀ** (2) Đủ 4/4 mục Checklist Kick-off (Google Drive 3 thư mục & phân quyền, PM xác nhận Scope, Timeline chuẩn, PM ước tính ngày công bàn giao).
- **Gatekeeper #2 (Đóng dự án & Quyết toán):** 100% Mốc đã Finish + đủ 3/3 mục bàn giao cuối (Source Code, HDSD/Video, Scan biên bản nghiệm thu) + 100% Đợt thanh toán `PAID` + 100% Hóa đơn VAT `ISSUED`.
- **Đèn Sức khỏe tự động:** `RED` (âm `Limit`, có mốc trễ, quá hạn thanh toán, hoặc PM bật cờ đỏ), `YELLOW` (vượt `Target` hoặc tiêu hao ≥ 85% `Target`, có CR chờ báo giá, quá chu kỳ chưa log Manday), `GREEN` (an toàn).

---

## 2. Kiến trúc Kỹ thuật & Tech Stack

Dự án tổ chức theo mô hình **Monorepo** (`api/` + `web/`) chạy trên dải port tách biệt:

| Môi trường | Database (PostgreSQL 15) | Backend API (`/api`) | Frontend Web (`/web`) |
| :--- | :--- | :--- | :--- |
| **Local Dev** | `localhost:5433` (`erp_am_db`) | `http://localhost:8081` | `http://localhost:3001` |
| **Develop (`docker-compose.develop.yml`)** | Host DB (`erp_am_dev`) | `5094` | `5095` |
| **Production (`docker-compose.deploy.yml`)** | Host DB | `5092` | `5093` |

- **Backend (`/api`):** Node.js, Express v5, Clean Architecture (`domain/` → `use_cases/` → `infrastructure/`), Raw SQL (`pg` Pool), `node-pg-migrate`, Zod, Swagger (OpenAPI 3.0), Jest.
- **Frontend (`/web`):** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Shadcn UI, TanStack Query v5, Orval (tự động sinh hooks & types từ `api/swagger.json`), React Hook Form + Zod.
- **CI/CD:** Dockerfiles cho `api/` & `web/` và GitLab CI pipeline tại `.gitlab-ci.yml`.

---

## 3. Hiện trạng Bàn giao & Lộ trình Tiếp theo

### Đã hoàn thành
1. **Frontend Interactive Prototype (100% luồng nghiệp vụ & UI/UX):**
   - Toàn bộ types, công thức tính 4 chỉ số, thuế VAT, thưởng 50/50, Gatekeepers và đèn sức khỏe tại `web/lib/mock/am-types.ts`.
   - Bộ dữ liệu mẫu tại `web/lib/mock/am-mock-data.ts` và state provider lưu `localStorage` tại `web/components/providers/am-prototype-provider.tsx`.
   - Đầy đủ các màn hình chức năng tại `web/components/features/am/` (Dashboard Tổng quan, Việc cần làm AM, Danh mục Hợp đồng, Khởi tạo & Pre-Project, Không gian chi tiết Hợp đồng 3 tab, Phát sinh & Hỗ trợ 0đ, ĐNTT & Hóa đơn VAT, Sổ Tạm ứng AM, Khách hàng).
2. **Backend Core Auth Base & Hợp đồng API Auth:**
   - Migration bảng `users` & `refresh_tokens` (`api/migrations/0000000000001_init-core-base.js`), seed tài khoản admin (`api/scripts/seed-admin.js`).
   - API `/api/v1/auth/*` (login, refresh, me, change-password) + Swagger + Orval hooks tại `web/lib/api/generated/authentication/`.

### Việc cần làm tiếp (Next Steps)
1. **Database Migration (`/api/migrations`):** Tạo các bảng PostgreSQL idempotent (có `deleted_at` soft delete) cho các thực thể nghiệp vụ từ `web/lib/mock/am-types.ts` (`customers`, `contracts`, `scope_items`, `scope_progress_logs`, `payment_installments`, `change_requests`, `am_expenses`, `project_documents`).
2. **Backend Clean Architecture (`/api/src`):** Xây dựng Domain, Repository (`pg` Pool), Use Cases (kèm Jest unit tests), Controllers & Routes (kèm JSDoc `@swagger`) cho các phân hệ trên.
3. **Đồng bộ Contract & Nối API Frontend:** Chạy `npm run gen:swagger` ở `/api` và `npm run gen-api` ở `/web`, sau đó thay thế state `localStorage` trong `am-prototype-provider.tsx` bằng các Orval hooks.

---

## 4. Khởi chạy Nhanh (Local Development)

Chi tiết xem thêm tại `DEPLOYMENT_GUIDE.md`.

```bash
# 1. Khởi động PostgreSQL container (Port 5433)
docker-compose up -d

# 2. Cài đặt, Migrate, Seed & chạy Backend API (Port 8081)
cd api
npm install
npm run migrate
npm run seed        # Tạo tài khoản mặc định: admin_root / Admin123@
npm run gen:swagger
npm run dev

# 3. Cài đặt, sinh Orval hooks & chạy Frontend Web (Port 3001)
cd ../web
npm install
npm run gen-api
npm run dev
```

- Giao diện Web: `http://localhost:3001`
- Tài liệu Swagger API: `http://localhost:8081/api-docs`

---

## 5. Tài liệu Dự án Liên quan

- `PRODUCT.md` — Bối cảnh sản phẩm, đối tượng sử dụng & nguyên tắc thiết kế nghiệp vụ.
- `DESIGN.md` — Hệ thống thiết kế UI ("The Ledger Cockpit"), bảng màu, typography & quy tắc WCAG AA.
- `TECHNICAL_GUIDELINE.md` — Chuẩn kiến trúc, Golden Rules (Orval-only, Parameterized SQL, Transactions, Envelope Pattern) & quy trình 5 bước phát triển tính năng.
- `DEPLOYMENT_GUIDE.md` — Cấu hình port & hướng dẫn triển khai các môi trường.
- `IMPLEMENTATION_PLAN.md` — Kế hoạch phân giai đoạn phát triển hệ thống.
- `AI_ORCHESTRATION_GUIDE.md` — Hướng dẫn sử dụng bộ AI Skills cấu hình sẵn cho dự án.
