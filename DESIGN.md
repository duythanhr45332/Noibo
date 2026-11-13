---
name: ERP-AM
description: B2B Contract, Manday Credit Ledger & Cashflow Operating System
colors:
  primary: "#0f234a"
  primary-hover: "#1e3a6e"
  surface-canvas: "#f8fafc"
  surface-card: "#ffffff"
  surface-subtle: "#f1f5f9"
  ink-primary: "#0f172a"
  ink-secondary: "#334155"
  ink-muted: "#475569"
  border-default: "#e2e8f0"
  border-subtle: "#f1f5f9"
  status-healthy: "#047857"
  status-healthy-bg: "#ecfdf5"
  status-warning: "#b45309"
  status-warning-bg: "#fffbeb"
  status-danger: "#b91c1c"
  status-danger-bg: "#fef2f2"
typography:
  display:
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  title:
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "var(--font-sans), system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-card}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  card-ledger:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.xl}"
    padding: "20px 24px"
---

# Design System: ERP-AM

## Overview

**Creative North Star: "The Ledger Cockpit"**

ERP-AM mang tinh thần của một buồng lái sổ cái hiện đại lấy cảm hứng từ Productive.io: mật độ thông tin cao nhưng thoáng mắt, bề mặt phẳng sắc nét, phân tách dữ liệu bằng đường kẻ mảnh `1px` (`#e2e8f0`) và khoảng trắng có nhịp điệu thay vì lồng nhiều lớp hộp thoại hay thẻ Card chồng chéo. Mọi quyết định thị giác đều phục vụ tốc độ quét mắt của Account Manager, Project Manager và Kế toán khi đối chiếu hàng chục mốc bàn giao, ngày công và hóa đơn.

Hệ thống từ chối các hiệu ứng trang trí rườm rà của giao diện AI đại trà (như đốm sáng radial-gradient trên nền tối, lưới kẻ ô trang trí vô nghĩa, nhãn chữ hoa nhỏ đặt trên tiêu đề chính, hay màu tím rời rạc ngoài hệ thống). Sự sang trọng của giao diện đến từ độ tương phản chữ rõ ràng, cột số liệu thẳng tắp và trạng thái cảnh báo chính xác.

**Key Characteristics:**
- **Phẳng và Tách lớp bằng Đường kẻ (`1px` Rule):** Chỉ dùng 1 lớp Card ngoài cùng cho mỗi vùng chức năng; các phần tử bên trong phân tách bằng đường kẻ ngang (`divide-y`) hoặc nền xám nhạt tinh tế.
- **Số liệu Sổ cái Chuẩn xác (`tabular-nums`):** Mọi con số tiền tệ, ngày công (`MD`), tỷ lệ phần trăm và ngày tháng đều dùng `tabular-nums` hoặc `font-mono`.
- **Một Giọng Màu Hành động Duy nhất:** Thống nhất màu Xanh Navy đậm (`#0f234a` / `bg-primary`) và Slate đậm (`#0f172a`) cho các hành động chính; dành toàn bộ màu rực (Đỏ, Vàng hổ phách, Xanh lục) cho tín hiệu sức khỏe hợp đồng.

## Colors

Bảng màu được xây dựng xoay quanh sắc Xanh Navy điều hành (`#0f234a`) trên nền giấy xám lạnh (`#f8fafc`), đảm bảo độ tương phản đọc đạt chuẩn WCAG AA (`>= 4.5:1`) ở mọi cấp độ chữ.

### Primary
- **Executive Navy** (`#0f234a` / `var(--primary)`): Màu nhận diện chủ đạo cho nút hành động chính (Primary CTA), trạng thái đang chọn trên thanh điều hướng và điểm nhấn thương hiệu.
- **Executive Navy Hover** (`#1e3a6e`): Trạng thái hover/active của nút hành động chính.

### Neutral
- **Cool Ledger Canvas** (`#f8fafc` / `bg-slate-50`): Nền tổng thể của không gian làm việc, tạo độ tách biệt dịu mắt với các bảng dữ liệu trắng.
- **Pure Sheet White** (`#ffffff`): Bề mặt chính của bảng sổ cái, danh sách công việc và hộp thoại.
- **Subtle Row Tint** (`#f1f5f9` / `bg-slate-100`): Nền của dòng tổng cộng (Grand Total), nhãn đếm số lượng và trạng thái hover dòng bảng.
- **Deep Slate Ink** (`#0f172a` / `text-slate-900`): Chữ tiêu đề, tên dự án và con số tài chính trọng yếu.
- **Body Slate Ink** (`#334155` / `text-slate-700`): Nội dung bảng, tên khách hàng và thông tin mô tả chính.
- **Muted Ledger Label** (`#475569` / `text-slate-600` & `#64748b` / `text-slate-500`): Tiêu đề cột bảng (`<th>`), chú thích công thức và nhãn phụ. Đảm bảo độ tương phản trên nền trắng luôn đạt từ `4.6:1` trở lên.
- **Hairline Divider** (`#e2e8f0` / `border-slate-200`): Đường viền khung bảng và vạch ngăn cách các khu vực.

### Semantic Status
- **Healthy / Accepted Emerald** (`#047857` trên nền `#ecfdf5`): Mốc đã nghiệm thu, khoản chi đã hoàn ứng, hoặc quỹ ngày công dương an toàn.
- **Warning / Check-in Amber** (`#b45309` trên nền `#fffbeb`): Nhắc nhở đến kỳ log Manday, chờ xuất hóa đơn VAT, hoặc sắp chạm ngưỡng Target.
- **Deficit / Overdue Crimson** (`#b91c1c` trên nền `#fef2f2`): Vượt trần Limit Manday (âm quỹ), quá hạn thanh toán, hoặc chi vượt tạm ứng.

### Named Rules
**The Single Primary Voice Rule.** Mọi nút CTA chính trên cả trang danh sách lẫn trong Modal/Dialog đều sử dụng thống nhất `--primary` (`#0f234a`) hoặc `slate-900` (`#0f172a`). Tuyệt đối không dùng màu tím rời rạc (`#5B3DF5`) làm phân mảnh nhận diện.

**The AA Ledger Contrast Rule.** Không bao giờ dùng `text-slate-400` (`#90a1b9`) cho chữ cần đọc trên nền trắng hoặc nền xám nhạt vì tỷ lệ tương phản chỉ đạt `2.6:1`. Mọi tiêu đề cột `<th>` và dòng mô tả phụ phải dùng tối thiểu `text-slate-500` (`#64748b`) hoặc `text-slate-600` (`#475569`).

## Typography

**Display & Body Font:** Hệ thống Sans-serif hiện đại (`var(--font-sans)`, fallback `system-ui, -apple-system, sans-serif`)
**Label / Code / Numeric Font:** Monospace kỹ thuật (`var(--font-mono)`, fallback `ui-monospace, SFMono-Regular, monospace`)

**Character:** Gọn gàng, thực dụng và ưu tiên khả năng đọc lướt nhanh trên các bảng đối soát nhiều cột.

### Hierarchy
- **Display / Page Title** (`600`, `1.25rem–1.5rem`, `line-height: 1.25`, `tracking: -0.02em`): Tiêu đề trang vận hành.
- **Headline / Section Header** (`600`, `1rem–1.125rem`, `line-height: 1.35`): Tiêu đề khối bảng đối soát và tiêu đề hộp thoại.
- **Title / Project Name** (`600`, `0.875rem–0.9375rem`, `line-height: 1.4`): Tên dự án/hợp đồng có thể bấm để mở chi tiết.
- **Body / Table Cell** (`400–500`, `0.8125rem–0.875rem`, `line-height: 1.5`): Nội dung hàng bảng, mô tả công việc và ghi chú kiểm toán.
- **Label / Contract Code** (`500–600`, `0.75rem`, `font-mono`): Mã hợp đồng (`HĐ-2026/...`), mã mốc (`M1`, `M2`) và các chỉ số `Real / Target / Limit`.

### Named Rules
**The Tabular Numerals Rule.** Mọi cột số tiền (`VNĐ`), số ngày công (`MD`), số lượng chứng từ và ngày tháng bắt buộc áp dụng `tabular-nums` và căn phải (`text-right`) đối với đại lượng đo lường để người dùng so sánh hàng dọc tức thì.

## Layout

Không gian làm việc sử dụng khung App Shell cố định chiều cao màn hình (`h-screen overflow-hidden` trên desktop) với thanh Header điều hướng ngang gọn gàng phía trên và vùng nội dung cuộn độc lập bên dưới (`px-6 lg:px-8 py-6`).

- **Bố cục Dashboard:** Lưới 12 cột (`grid-cols-1 lg:grid-cols-12 gap-6`), trong đó bảng Sổ cái Ngân sách hoặc Việc cần làm chiếm `8/12` cột và Sổ Hỗ trợ 0đ / Phụ lục phát sinh chiếm `4/12` cột.
- **Mật độ Bảng (Table Density):** Padding dòng tiêu chuẩn `py-3 px-3` (hoặc `py-3.5`), giữ khoảng cách vừa đủ để hiển thị 10–15 hợp đồng trên một khung nhìn mà không bị dính chữ.

## Elevation & Depth

Hệ thống áp dụng triết lý **Flat-By-Default (Phẳng mặc định)**. Độ sâu không được tạo bằng bóng đổ mờ lan rộng mà bằng sự tương phản bề mặt giữa nền Canvas (`#f8fafc`) và tấm bảng trắng (`#ffffff`) có viền mảnh `1px solid #e2e8f0`.

### Named Rules
**The No-Nested-Cards Rule.** Một vùng chứa đã có khung viền (`rounded-xl border border-slate-200 bg-white`) thì các danh sách dự án hoặc hạng mục con bên trong tuyệt đối không được bọc thêm một lớp Card có `border` nữa. Hãy dùng đường phân cách ngang (`divide-y divide-slate-100`) để giữ mặt phẳng thị giác sạch sẽ.

## Shapes

- **Khung Bảng & Khối Chức năng Chính:** Bo góc vừa phải (`12px` / `rounded-xl`) kèm viền `1px` (`border-slate-200`).
- **Nút bấm & Ô nhập liệu:** Bo góc chuẩn công cụ (`6px–8px` / `rounded-md` hoặc `rounded-lg`), chiều cao đồng nhất `36px` (`h-9`) trên thanh công cụ và `32px` (`h-8`) cho tác vụ nội dòng.
- **Nhãn Trạng thái (Status Badges):** Dạng thẻ chữ nhật bo nhẹ (`6px` / `rounded-md`, `px-2.5 py-0.5`), tránh dùng pill tròn trịa quá mức cho các nhãn chứa nhiều chữ.

## Components

### Buttons
- **Shape:** Bo góc `8px` (`rounded-lg`), chiều cao `36px` (`h-9`) cho tác vụ chính hoặc `32px` (`h-8`) trong bảng.
- **Primary:** Nền `#0f234a` (`bg-primary`), chữ trắng `#ffffff`, font-weight `500`.
- **Hover / Focus:** Chuyển sang `#1e3a6e` (`hover:bg-primary/90`), focus ring `2px` rõ nét.
- **Secondary / Outline:** Nền trắng `#ffffff`, viền `#e2e8f0`, chữ `#334155`, hover nền `#f8fafc`.

### Chips & Filter Tabs
- **Style:** Nút lọc nhanh theo Tag hoặc Hạng mục dùng viền mảnh `1px`, padding `px-2.5 py-1`, kèm vùng chạm tối thiểu `24x24px` cho nút xóa nhãn.
- **State:** Trạng thái đang chọn đổi sang nền tối (`bg-primary text-primary-foreground`) hoặc viền màu ngữ nghĩa đậm.

### Cards / Ledger Containers
- **Corner Style:** `12px` (`rounded-xl`).
- **Background:** `#ffffff` trên nền trang `#f8fafc`.
- **Shadow Strategy:** Không dùng shadow ở trạng thái tĩnh (`shadow-none`).
- **Border:** `1px solid #e2e8f0`.
- **Internal Padding:** Header khối `px-5 py-4`, nội dung bảng tràn viền ngang với `overflow-x-auto`.

### Inputs / Fields
- **Style:** Nền trắng `#ffffff`, viền `#e2e8f0`, chữ `#0f172a`, placeholder tối thiểu đạt tương phản chuẩn (`#64748b`).
- **Focus:** Đổi màu viền sang `#0f234a` kèm vòng ring mảnh.

### Navigation
- **App Header:** Thanh điều hướng đỉnh trang tích hợp chuyển đổi nhanh giữa các mặt phẳng vận hành (Tổng quan, Việc cần làm AM, Danh mục Hợp đồng, ĐNTT & Hóa đơn VAT, Quỹ Tạm ứng AM, Khách hàng) và nút chuyển góc nhìn vai trò (`AM` / `PM`).

## Do's and Don'ts

### Do:
- **Do** sử dụng `tabular-nums` và `text-right` cho mọi cột số tiền (`VNĐ`) và ngày công (`MD`).
- **Do** dùng `text-slate-500` (`#64748b`) hoặc đậm hơn cho toàn bộ tiêu đề cột `<th>` và văn bản mô tả phụ trên nền sáng.
- **Do** dùng `divide-y divide-slate-100` để phân tách các mục bên trong một Card thay vì tạo thêm các thẻ có viền lồng bên trong.
- **Do** đảm bảo các nút xóa nhỏ (như xóa Tag hợp đồng) có kích thước vùng bấm tối thiểu `24x24px`.

### Don't:
- **Don't** lồng thẻ `.rounded-lg.border` bên trong một `.rounded-xl.border` (`nested-cards`).
- **Don't** dùng `text-slate-400` cho văn bản thông tin hoặc placeholder trên nền trắng/xám nhạt (`low-contrast`).
- **Don't** hardcode màu tím `#5B3DF5` cho nút lưu hoặc badge khi hệ thống đã định nghĩa `--primary: #0f234a`.
- **Don't** đặt nhãn chữ hoa nhỏ (kicker/eyebrow) ngay phía trên thẻ `<h1>` hoặc dùng lưới kẻ ô / đốm sáng radial-gradient trang trí vô nghĩa trên nền tối.

