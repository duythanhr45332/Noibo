# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Account Managers (AM):** Theo dõi tiến độ dự án theo các mốc bàn giao (Milestones), quản lý quỹ ngày công (Manday Credit Pool), ghi nhận yêu cầu hỗ trợ miễn phí 0đ (Goodwill) hoặc báo giá phụ lục phát sinh (Change Requests / Upsell), đôn đốc thu hồi công nợ/xuất hóa đơn VAT và đối soát quỹ tạm ứng công tác.
- **Project Managers (PM):** Phối hợp ước lượng nỗ lực thực thi (`Target` / `Estimate` / `Real` Mandays), xác nhận checklist Kick-off và kiểm soát giới hạn ngày công của đội kỹ thuật (chế độ xem ẩn doanh thu nhạy cảm khi phân quyền PM).
- **Ban Giám đốc & Kế toán (BOD / Accounting):** Giám sát sức khỏe danh mục hợp đồng, đối soát dòng tiền đợt thanh toán, xuất hóa đơn GTGT (VAT) và quyết toán quỹ tạm ứng AM hoặc quỹ thưởng hiệu suất 50/50.

## Product Purpose

**ERP-AM** là hệ thống quản trị hợp đồng, ngân sách ngày công (Manday Credit Ledger) và dòng tiền dự án phần mềm B2B. Sản phẩm giúp tách bạch minh bạch giữa **Quỹ Ngày Công Sản Xuất** (Limit / Target / Estimate / Real Mandays & Thưởng 50/50), **Sổ Theo Dõi Hỗ Trợ 0đ & Phụ Lục Upsell**, và **Sổ Tạm Ứng Công Tác AM** — giúp doanh nghiệp ngăn chặn thất thoát nguồn lực (scope creep) và thu hồi công nợ đúng hạn theo từng mốc nghiệm thu.

## Positioning

Khác với các công cụ quản lý task thông thường chỉ đếm giờ làm việc rời rạc, **ERP-AM** gắn chặt mỗi **Mốc bàn giao (Milestone)** với **4 chỉ số Manday cốt lõi (`Limit` → `Target` → `Estimate` → `Real`)**, **Đợt thanh toán hợp đồng & Hóa đơn VAT**, cùng **bằng chứng hỗ trợ 0đ tích lũy** để AM có cơ sở dữ liệu tức thì khi đàm phán phụ lục tính phí với khách hàng.

## Operating Context

- Môi trường làm việc văn phòng B2B mật độ thông tin cao, sử dụng hàng ngày trên trình duyệt máy tính bàn/laptop màn hình rộng và tablet khi họp nghiệm thu.
- Các nghi thức vận hành thực tế: Check-in trừ lùi Manday định kỳ 3–5 ngày/lần, kiểm duyệt 4 điều kiện Kick-off bắt buộc trước khi vào dự án, sao chép biên bản bằng chứng hỗ trợ 0đ gửi qua Zalo/Email cho khách hàng, và đối soát chứng từ tạm ứng với Kế toán.

## Capabilities and Constraints

- **Stack kỹ thuật:** Next.js (App Router), React 19, TypeScript, Tailwind CSS v4, Shadcn UI, React Hook Form + Zod, Orval + TanStack Query, Node.js/Express & PostgreSQL.
- **Ràng buộc kiến trúc:** Mọi API tuân thủ Envelope Pattern (`{ success, data, errors, timestamp }`), xóa mềm (`deleted_at`), và phân tách rõ quyền hiển thị tài chính giữa vai trò `AM` và `PM`.
- **Ngôn ngữ hiển thị:** Giao diện tiếng Việt chuẩn nghiệp vụ quản trị dự án & kế toán doanh nghiệp Việt Nam; đơn vị tiền tệ `VNĐ` và đơn vị nỗ lực `MD` (Mandays).

## Brand Commitments

- **Tông giọng (Voice):** Rõ ràng, dứt khoát, thực dụng và chuẩn xác theo ngôn ngữ sổ cái kế toán – vận hành dự án.
- ** Màu nhận diện cốt lõi:** Xanh Navy đậm chủ đạo (`#0f234a` / `slate-900`) kết hợp bề mặt giấy xám lạnh (`#f8fafc`) và hệ màu trạng thái ngữ nghĩa (Xanh lục nghiệm thu, Vàng hổ phách cảnh báo, Đỏ vượt hạn mức).

## Evidence on Hand

- Dữ liệu mẫu vận hành thực tế tại `web/lib/mock/am-types.ts` và hệ thống màn hình tại `web/components/features/am/`.
- Tài sản thương hiệu: `/web/public/logo.svg`.

## Product Principles

1. **Sổ cái một ánh nhìn (Single-Glance Ledger Truth):** Mọi con số tài chính và ngày công phải đối chiếu được ngay trên cùng một mặt phẳng mà không cần mở nhiều lớp hộp thoại.
2. **Tách bạch hai dòng quỹ (Strict Fund Separation):** Không bao giờ trộn lẫn Quỹ Tạm Ứng Công Tác của AM (Taxi, Ship, Tiếp khách) với Quỹ Ngày Công Sản Xuất và Thưởng 50/50 của đội dự án.
3. **Bằng chứng trước khi đàm phán (Evidence-Backed Account Management):** Mọi yêu cầu hỗ trợ 0đ ngoài phạm vi đều phải được quy đổi thành giá trị ngày công thực tế để làm bằng chứng đàm phán phụ lục.
4. **Hành động 1 chạm từ cảnh báo (Zero-Friction Action Inbox):** Mỗi cảnh báo quá hạn check Manday hoặc công nợ đều đi kèm nút thao tác trực tiếp ngay tại dòng cảnh báo.

## Accessibility & Inclusion

- Đảm bảo độ tương phản chữ đạt chuẩn **WCAG AA (`>= 4.5:1`)** trên mọi bảng số liệu, tiêu đề cột và nhãn phụ để tránh mỏi mắt khi tra cứu sổ cái nhiều giờ liên tục.
- Mọi cột số tiền, ngày công và tỷ lệ phần trăm bắt buộc định dạng `tabular-nums` để căn thẳng hàng dọc tuyệt đối.

