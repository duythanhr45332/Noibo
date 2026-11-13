---
version: 1
slug: "s-features-am-productivehomedashboard-tsx-ca29e21b"
primary_target: "web/components/features/am/ProductiveHomeDashboard.tsx"
related_targets: ["web/components/layout/app-header.tsx"]
---

# Surface Brief: ERP-AM Home & Workspace Shell

## Scope & Mode
- **Target:** `web/components/features/am/ProductiveHomeDashboard.tsx` & `web/components/layout/app-header.tsx`
- **Mode:** `operate`

## Audience & Primary Job
- **Audience:** Account Managers (AM), Project Managers (PM), và Ban Giám Đốc / Kế toán mở hệ thống mỗi sáng.
- **5-Second Job:** Phát hiện ngay dự án nào đang "chảy máu" ngày công (vượt `Target` / `Limit`) và đợt thanh toán nào cần đòi tiền / xuất hóa đơn VAT ngay hôm nay mà không phải đọc từng dòng bảng chữ dày đặc.

## Direction contract

- **THESIS:** Biến trang Tổng quan từ các bảng chữ phẳng kiểu CRUD/Excel thành một "Buồng lái Triage Tài chính 2 tầng" (Swiss Financial Triage Cockpit): Tầng 1 trên đỉnh là Dải Triage Khẩn Cấp 3-cột (Chảy máu Manday | Công nợ đến hạn cần đòi | Quỹ thưởng 50/50 & Hỗ trợ 0đ), Tầng 2 là Sổ Cái Bullet-Chart trực quan hóa cả 4 ngưỡng `Real / Estimate / Target / Limit` trên một thanh thước nhiệt duy nhất kèm thao tác 1 chạm.
- **OWN-WORLD:** Bề mặt giấy xám lạnh (`#f8fafc`), khung sổ cái trắng sắc nét viền `1px` (`#e2e8f0`), thanh điều hướng và điểm nhấn Executive Navy (`#0f234a`), chữ `IBM Plex Sans` kết hợp số liệu `JetBrains Mono` (`tabular-nums`), cùng thanh Bullet-Chart 3 tầng màu ngữ nghĩa (Xanh lục an toàn, Vàng cảnh báo chạm Target, Đỏ vượt trần Limit).
- **STORY:** Mở màn hình lên thấy ngay con số báo động ở Dải Triage 5-giây; bấm vào thẻ báo động nào là danh sách dự án bên dưới lọc ngay theo nhóm đó; nhìn vào thanh Bullet-Chart của từng dự án thấy ngay độ lố ngày công và bấm 1 chạm để Log Manday, Mở Hợp đồng, hoặc Sao chép biên bản Bằng chứng 0đ gửi Zalo cho khách.
- **FIRST VIEWPORT:** (1) Thanh App Header Navy/Trắng tinh gọn có chỉ báo nhanh trạng thái danh mục; (2) Dải **5-Second Executive Triage Strip** chia 3 ô liền khối có viền trái ngữ nghĩa, số đại cảnh (`32px` bold `tabular-nums`) và nút lọc nhanh; (3) Khối **Split Workspace 8/4**: Bên trái (8 cột) là **Sổ Cái Ngân Sách Bullet-Chart & Việc Cần Xử Lý Hôm Nay** có thanh tiến độ kép `Real vs Target vs Limit`; Bên phải (4 cột) là **Timeline Bằng Chứng Hỗ Trợ 0đ & Phụ Lục Phát Sinh** kèm nút Copy 1 chạm.
- **FORM:** Swiss Financial Triage Cockpit (position 1 of 7, seed:f71588826131a07f)
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
