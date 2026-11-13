"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconEye,
  IconEyeOff,
  IconPlus,
  IconRefresh,
} from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import {
  DemoRoleView,
  ScreenTab,
} from "@/lib/mock/am-types"

const ROLE_LABELS: Record<
  DemoRoleView,
  { code: string; name: string; subtitle: string }
> = {
  AM: {
    code: "AM",
    name: "AM Thảo",
    subtitle: "Quản lý 4 chỉ số ngân sách ngày công & Nhắc việc",
  },
  BOD: {
    code: "GD",
    name: "Ban Giám Đốc",
    subtitle: "Toàn quyền P&L, Cấp trần ngày công & Quỹ thưởng 50/50",
  },
  PM: {
    code: "PM",
    name: "Quản lý Dự án (PM)",
    subtitle: "Báo cáo ngày công định kỳ & Xem mức giao (Khóa ẩn Giá tiền)",
  },
}

const PRODUCTIVE_TABS: Array<{
  id: ScreenTab
  label: string
  subtitle: string
  matchScreens: ScreenTab[]
}> = [
  {
    id: "dashboard",
    label: "Tổng quan",
    subtitle: "Tổng quan việc cần làm & Sổ cái ngân sách",
    matchScreens: ["dashboard", "am-tasks"],
  },
  {
    id: "contracts",
    label: "Dự án",
    subtitle: "Danh sách Dự án & Bảng 4 chỉ số theo Mốc bàn giao",
    matchScreens: ["contracts", "project-detail", "create-contract"],
  },
  {
    id: "billing-vat",
    label: "Tài chính & VAT",
    subtitle: "Thu tiền theo Mốc, Hóa đơn VAT & Quỹ thưởng 50/50",
    matchScreens: ["billing-vat"],
  },
  {
    id: "am-expenses",
    label: "Chi phí AM",
    subtitle: "Sổ Tạm ứng & Chi phí công tác AM (Taxi, Ship...)",
    matchScreens: ["am-expenses"],
  },
  {
    id: "customers",
    label: "Khách hàng",
    subtitle: "Danh bạ Khách hàng & Đầu mối liên hệ",
    matchScreens: ["customers"],
  },
]

export function AppHeader() {
  const {
    contracts,
    activeScreen,
    setActiveScreen,
    roleView,
    setRoleView,
    togglePriceVisible,
    hidePrice,
    resetDemoData,
  } = useAmPrototype()

  const urgentCount = React.useMemo(() => {
    let count = 0
    contracts.forEach((c) => {
      const totalLimit = c.scopeItems.reduce(
        (acc, s) => acc + (s.limitMandays ?? s.estimatedMandays ?? 0),
        0
      )
      const totalReal = c.scopeItems.reduce(
        (acc, s) => acc + (s.actualMandays ?? 0),
        0
      )
      const hasOverduePayment = c.installments.some(
        (i) => i.paymentStatus === "OVERDUE"
      )
      if (totalReal > totalLimit || hasOverduePayment) count += 1
    })
    return count
  }, [contracts])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white text-slate-900">
      <div className="flex h-14 items-center justify-between px-6 lg:px-8 gap-4">
        {/* Left: Logo + Tên hệ thống + 5 Menu Chính */}
        <div className="flex items-center gap-7 h-full overflow-x-auto">
          <Link
            href="/"
            onClick={() => setActiveScreen("dashboard")}
            className="flex items-center gap-2.5 shrink-0 pr-4 border-r border-slate-200"
          >
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              AM
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-slate-900 tracking-tight leading-none">
                ERP-AM
              </span>
              <span className="text-[11px] font-medium text-slate-500 mt-0.5 leading-none">
                Quản trị Hợp đồng
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-6 h-full">
            {PRODUCTIVE_TABS.map((tab) => {
              const isActive = tab.matchScreens.includes(activeScreen)
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveScreen(tab.id)}
                  title={tab.subtitle}
                  className={cn(
                    "relative h-full flex items-center gap-1.5 text-sm transition-colors whitespace-nowrap px-1",
                    isActive
                      ? "font-semibold text-primary"
                      : "font-medium text-slate-600 hover:text-slate-900"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.id === "dashboard" && urgentCount > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-[11px] font-semibold px-1.5 py-0.2 tabular-nums">
                      {urgentCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-t bg-primary" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right: Các nút điều khiển thực tế */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={togglePriceVisible}
            disabled={roleView === "PM"}
            title={
              roleView === "PM"
                ? "Quản lý Dự án (PM) luôn bị khóa ẩn số tiền"
                : "Bấm để Bật / Tắt hiển thị giá trị tiền trên toàn hệ thống"
            }
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {hidePrice ? (
              <>
                <IconEyeOff className="size-4 text-slate-500" />
                <span>Giá tiền: Đang ẩn</span>
              </>
            ) : (
              <>
                <IconEye className="size-4 text-slate-900" />
                <span>Giá tiền: Đang hiện</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveScreen("create-contract")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-[13px] font-medium transition-colors"
            title="Khởi tạo Dự án / Hợp đồng mới"
          >
            <IconPlus className="size-4" />
            <span className="hidden sm:inline">Tạo dự án</span>
          </button>

          <button
            type="button"
            onClick={resetDemoData}
            aria-label="Khôi phục dữ liệu mẫu"
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="Khôi phục dữ liệu mẫu"
          >
            <IconRefresh className="size-4.5" />
          </button>

          {/* Avatar đổi góc nhìn (AM / BOD / PM) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 px-3 py-1.5 text-[13px] font-semibold transition-colors"
                title="Đổi vai trò xem dữ liệu (AM / Giám đốc / PM)"
              >
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {ROLE_LABELS[roleView].code}
                </span>
                <span className="hidden md:inline font-medium text-slate-800">
                  {ROLE_LABELS[roleView].name}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs">
                Chuyển góc nhìn phân quyền (AM / Giám đốc / PM)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(["AM", "BOD", "PM"] as DemoRoleView[]).map((r) => (
                <DropdownMenuItem
                  key={r}
                  className="cursor-pointer flex flex-col items-start gap-0.5 py-2.5"
                  onClick={() => setRoleView(r)}
                >
                  <div className="font-semibold text-sm flex items-center justify-between w-full">
                    <span>{ROLE_LABELS[r].name}</span>
                    {roleView === r && (
                      <span className="text-xs bg-slate-100 text-slate-900 px-2 py-0.5 rounded font-semibold">
                        Đang chọn
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {ROLE_LABELS[r].subtitle}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
