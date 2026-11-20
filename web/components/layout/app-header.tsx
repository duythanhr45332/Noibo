"use client"

import * as React from "react"
import Link from "next/link"
import { FastLink, useFastPathname } from "@/lib/fast-nav"
import {
  IconEye,
  IconEyeOff,
  IconHistory,
  IconKey,
  IconLogin,
  IconLogout,
  IconPlus,
  IconUsers,
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
import { useAuth } from "@/components/providers/auth-provider"
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider"
import { ChangePasswordModal } from "@/components/features/auth/ChangePasswordModal"
import {
  useWorkspaceContracts,
  useWorkspaceRole,
} from "@/lib/hooks/use-workspace-data"
import { ScreenTab } from "@/lib/mock/am-types"

const PRODUCTIVE_TABS: Array<{
  id: ScreenTab | "audit-logs"
  href: string
  label: string
  subtitle: string
  matchPaths: (pathname: string) => boolean
}> = [
  {
    id: "dashboard",
    href: "/",
    label: "Tổng quan",
    subtitle: "Tổng quan việc cần làm & Sổ cái ngân sách",
    matchPaths: (p) => p === "/" || p.startsWith("/tasks"),
  },
  {
    id: "contracts",
    href: "/contracts",
    label: "Dự án",
    subtitle: "Danh sách Dự án & Bảng 4 chỉ số theo Mốc bàn giao",
    matchPaths: (p) => p === "/contracts" || p.startsWith("/contracts/"),
  },
  {
    id: "billing-vat",
    href: "/billing-vat",
    label: "Tài chính & VAT",
    subtitle: "Thu tiền theo Mốc, Hóa đơn VAT & Quỹ thưởng 50/50",
    matchPaths: (p) => p.startsWith("/billing-vat"),
  },
  {
    id: "am-expenses",
    href: "/am-expenses",
    label: "Chi phí AM",
    subtitle: "Sổ Tạm ứng & Chi phí công tác AM (Taxi, Ship...)",
    matchPaths: (p) => p.startsWith("/am-expenses"),
  },
  {
    id: "customers",
    href: "/customers",
    label: "Khách hàng",
    subtitle: "Danh bạ Khách hàng & Đầu mối liên hệ",
    matchPaths: (p) => p.startsWith("/customers"),
  },
  {
    id: "audit-logs",
    href: "/audit-logs",
    label: "Kiểm toán",
    subtitle: "Tra cứu Nhật ký Kiểm toán & Lịch sử thay đổi dữ liệu",
    matchPaths: (p) => p.startsWith("/audit-logs"),
  },
]

export function AppHeader() {
  const pathname = useFastPathname()
  const { user, isAuthenticated, logout } = useAuth()
  const { isPmRole, canViewAuditLogs } = useWorkspaceRole()
  const { hidePrice, togglePriceVisible } = useWorkspaceUi()
  const [changePwdOpen, setChangePwdOpen] = React.useState(false)

  const { contracts } = useWorkspaceContracts({ includeDetails: true })

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
        {/* Left: Tên hệ thống + Menu Chính */}
        <div className="flex items-center gap-7 h-full overflow-x-auto">
          <FastLink
            href="/"
            className="flex items-center shrink-0 pr-4 border-r border-slate-200"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-slate-900 tracking-tight leading-none">
                ERP-AM
              </span>
              <span className="text-[11px] font-medium text-slate-500 mt-0.5 leading-none">
                Quản trị Hợp đồng
              </span>
            </div>
          </FastLink>

          <nav className="flex items-center gap-6 h-full">
            {PRODUCTIVE_TABS.filter((tab) => {
              if (tab.id !== "audit-logs") return true
              return canViewAuditLogs
            }).map((tab) => {
              const isActive = tab.matchPaths(pathname || "/")
              return (
                <FastLink
                  key={tab.id}
                  href={tab.href}
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
                </FastLink>
              )
            })}
          </nav>
        </div>

        {/* Right: Điều khiển & Tài khoản */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={togglePriceVisible}
            disabled={isPmRole}
            title={
              isPmRole
                ? "Quản lý Dự án (PM) luôn bị khóa ẩn số tiền"
                : "Bấm để Bật / Tắt hiển thị giá trị tiền trên toàn hệ thống"
            }
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-60"
          >
            {hidePrice ? (
              <>
                <IconEyeOff className="size-4 text-slate-500" />
                <span className="hidden xl:inline">Giá tiền: Đang ẩn</span>
              </>
            ) : (
              <>
                <IconEye className="size-4 text-slate-900" />
                <span className="hidden xl:inline">Giá tiền: Đang hiện</span>
              </>
            )}
          </button>

          {!isPmRole && (
            <FastLink
              href="/contracts/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 text-[13px] font-medium transition-colors"
              title="Khởi tạo Dự án / Hợp đồng mới"
            >
              <IconPlus className="size-4" />
              <span className="hidden sm:inline">Tạo dự án</span>
            </FastLink>
          )}

          {/* Menu Tài khoản */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900 px-3 py-1.5 text-[13px] font-semibold transition-colors"
                title="Thông tin tài khoản & Vai trò"
              >
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                  {isAuthenticated ? (user?.role || "U").slice(0, 2) : "?"}
                </span>
                <span className="hidden md:inline font-medium text-slate-800 max-w-[140px] truncate">
                  {isAuthenticated ? user?.full_name : "Chưa đăng nhập"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              {isAuthenticated && user ? (
                <>
                  <DropdownMenuLabel className="py-2">
                    <div className="font-semibold text-sm text-slate-900 truncate">
                      {user.full_name}
                    </div>
                    <div className="text-xs font-normal text-muted-foreground flex items-center justify-between mt-0.5">
                      <span>@{user.username}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                        {user.role}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(user.role === "ADMIN" || user.role === "BOD") && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <FastLink href="/users" className="flex items-center gap-2">
                        <IconUsers className="size-4 text-slate-600" />
                        <span>Quản lý Tài khoản (/users)</span>
                      </FastLink>
                    </DropdownMenuItem>
                  )}
                  {(user.role === "ADMIN" ||
                    user.role === "BOD" ||
                    user.role === "ACCOUNTANT" ||
                    user.role === "AM") && (
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <FastLink href="/audit-logs" className="flex items-center gap-2">
                        <IconHistory className="size-4 text-slate-600" />
                        <span>Nhật ký Kiểm toán (/audit-logs)</span>
                      </FastLink>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center gap-2"
                    onClick={() => setChangePwdOpen(true)}
                  >
                    <IconKey className="size-4 text-slate-600" />
                    <span>Đổi mật khẩu</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex items-center gap-2 text-red-600 focus:text-red-600"
                    onClick={() => logout()}
                  >
                    <IconLogout className="size-4" />
                    <span>Đăng xuất</span>
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/login" className="flex items-center gap-2 font-medium text-primary">
                    <IconLogin className="size-4" />
                    <span>Đăng nhập</span>
                  </Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ChangePasswordModal open={changePwdOpen} onOpenChange={setChangePwdOpen} />
    </header>
  )
}
