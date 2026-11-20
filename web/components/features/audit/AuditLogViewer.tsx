"use client"

import * as React from "react"
import Link from "next/link"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconCopy,
  IconDownload,
  IconFilterOff,
  IconHistory,
  IconRefresh,
  IconSearch,
  IconShieldCheck,
  IconUserCheck,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { StandardPagination } from "@/components/ui/standard-pagination"
import { useAuth } from "@/components/providers/auth-provider"
import { useWorkspaceRole } from "@/lib/hooks/use-workspace-data"
import { PersonAvatar } from "@/components/features/am/ProductiveHomeDashboard"
import { FastLink } from "@/lib/fast-nav"
import { useGetApiV1AuditLogs } from "@/lib/api/generated/audit-logs/audit-logs"
import { cn } from "@/lib/utils"
import { escapeCsvCell } from "@/lib/utils/export-utils"

interface NormalizedAuditLog {
  audit_log_id: string
  entity_name: string
  entity_id: string
  action: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_by: string | null
  actor_username: string
  actor_full_name: string
  actor_role: string
  created_at: string
}

const SENSITIVE_ACTIONS = new Set([
  "REOPEN_MILESTONE",
  "DISBURSE_MILESTONE_BONUS",
  "MARK_INSTALLMENT_PAID",
  "CLOSE_CONTRACT",
  "DELETE_CUSTOMER",
  "LOCK_USER",
  "UPDATE_USER_AND_RESET_PASSWORD",
  "CHANGE_PASSWORD",
])

const ENTITY_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  contracts: {
    label: "Hợp đồng / Dự án",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  scope_items: {
    label: "Mốc bàn giao",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  payment_installments: {
    label: "Thu tiền & VAT",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  change_requests: {
    label: "Phát sinh (CR)",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
  },
  am_expenses: {
    label: "Chi phí AM",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  customers: {
    label: "Khách hàng",
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
  },
  users: {
    label: "Nhân sự & RBAC",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
  },
}

const ACTION_META: Record<
  string,
  { label: string; tone: "neutral" | "positive" | "warning" | "danger" }
> = {
  CREATE_CONTRACT: { label: "Khởi tạo Hợp đồng", tone: "positive" },
  UPDATE_CONTRACT: { label: "Cập nhật Hợp đồng", tone: "neutral" },
  KICKOFF_CONTRACT: { label: "Kick-off Dự án", tone: "positive" },
  CLOSE_CONTRACT: { label: "Đóng Dự án & Quyết toán", tone: "warning" },
  UPDATE_SCOPE_ITEM: { label: "Sửa 4 chỉ số Mốc", tone: "neutral" },
  FINISH_MILESTONE: { label: "Hoàn thành Mốc (Finish)", tone: "positive" },
  REOPEN_MILESTONE: { label: "Mở lại Mốc (Reopen)", tone: "danger" },
  DISBURSE_MILESTONE_BONUS: { label: "Thực chi thưởng 50%", tone: "warning" },
  MARK_INSTALLMENT_PAID: { label: "Xác nhận Thu tiền (PAID)", tone: "positive" },
  UPDATE_INSTALLMENT_VAT: { label: "Cập nhật Hóa đơn VAT", tone: "neutral" },
  APPROVE_UPSELL_CR: { label: "Duyệt Phụ lục Upsell", tone: "positive" },
  CREATE_CUSTOMER: { label: "Thêm Khách hàng", tone: "positive" },
  UPDATE_CUSTOMER: { label: "Sửa Hồ sơ Khách hàng", tone: "neutral" },
  DELETE_CUSTOMER: { label: "Xóa mềm Khách hàng", tone: "danger" },
  CREATE_USER: { label: "Tạo Tài khoản", tone: "positive" },
  UPDATE_USER: { label: "Cập nhật Tài khoản", tone: "neutral" },
  UPDATE_USER_AND_RESET_PASSWORD: {
    label: "Cập nhật & Đặt lại MK",
    tone: "warning",
  },
  ACTIVATE_USER: { label: "Mở khóa Tài khoản", tone: "positive" },
  LOCK_USER: { label: "Khóa Tài khoản", tone: "danger" },
  CHANGE_PASSWORD: { label: "Đổi mật khẩu cá nhân", tone: "warning" },
}

const FIELD_LABELS: Record<string, string> = {
  code: "Mã",
  name: "Tên",
  title: "Tiêu đề",
  phase: "Giai đoạn dự án",
  base_contract_value: "Giá trị HĐ gốc (VNĐ)",
  initial_max_mandays: "Trần ngày công HĐ (MD)",
  limit_mandays: "1. Trần tối đa (MD)",
  target_mandays: "2. Mức giao PM (MD)",
  estimated_mandays: "3. PM ước tính (MD)",
  actual_mandays: "4. Thực tế tiêu (MD)",
  efficiency_status: "Hiệu suất Mốc",
  bonus_payout_status: "Trạng thái thưởng 50%",
  bonus_mandays: "Ngày công thưởng 50%",
  bonus_paid_amount: "Số tiền thực chi thưởng (VNĐ)",
  payment_status: "Trạng thái thanh toán",
  paid_date: "Ngày thu tiền",
  vat_invoice_status: "Trạng thái HĐ VAT",
  vat_invoice_number: "Số hóa đơn VAT",
  status: "Trạng thái",
  amount_vnd: "Số tiền (VNĐ)",
  quoted_price_vnd: "Giá báo khách (VNĐ)",
  tax_code: "Mã số thuế",
  industry: "Ngành nghề",
  address: "Địa chỉ",
  note: "Ghi chú",
  reason: "Lý do",
  full_name: "Họ và tên",
  username: "Tên đăng nhập",
  department: "Phòng ban",
  role: "Vai trò",
  is_active: "Đang hoạt động",
  kpi_bonus_split_percent: "Tỷ lệ thưởng KPI (%)",
  unlocked_scopes: "Mốc mở khóa thưởng",
  total_handover_estimate_md: "Ước tính bàn giao (MD)",
}

function getActionBadgeClass(action: string): string {
  const tone = ACTION_META[action]?.tone || "neutral"
  switch (tone) {
    case "positive":
      return "bg-emerald-50 text-emerald-700 border-emerald-200"
    case "warning":
      return "bg-amber-50 text-amber-800 border-amber-200"
    case "danger":
      return "bg-rose-50 text-rose-700 border-rose-200"
    default:
      return "bg-slate-100 text-slate-700 border-slate-200"
  }
}

function formatDateTimeVi(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function formatFieldValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === "") return "—"
  if (typeof val === "boolean") return val ? "Có (true)" : "Không (false)"
  if (typeof val === "number") {
    if (
      key.includes("amount") ||
      key.includes("value") ||
      key.includes("price") ||
      key.includes("vnd")
    ) {
      return `${val.toLocaleString("vi-VN")} ₫`
    }
    return String(val)
  }
  if (Array.isArray(val)) {
    return val.length === 0 ? "[]" : val.map((v) => String(v)).join(", ")
  }
  if (typeof val === "object") {
    return JSON.stringify(val)
  }
  return String(val)
}

interface DiffRow {
  key: string
  label: string
  oldVal: unknown
  newVal: unknown
  kind: "ADDED" | "REMOVED" | "CHANGED" | "UNCHANGED"
}

function computeFieldDiffs(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): DiffRow[] {
  const keys = Array.from(
    new Set([
      ...Object.keys(oldValues || {}),
      ...Object.keys(newValues || {}),
    ])
  )
  return keys.map((key) => {
    const hasOld = Boolean(oldValues && Object.prototype.hasOwnProperty.call(oldValues, key))
    const hasNew = Boolean(newValues && Object.prototype.hasOwnProperty.call(newValues, key))
    const oldVal = hasOld ? oldValues?.[key] : undefined
    const newVal = hasNew ? newValues?.[key] : undefined

    let kind: DiffRow["kind"] = "UNCHANGED"
    if (!hasOld && hasNew) kind = "ADDED"
    else if (hasOld && !hasNew) kind = "REMOVED"
    else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) kind = "CHANGED"

    return {
      key,
      label: FIELD_LABELS[key] || key,
      oldVal,
      newVal,
      kind,
    }
  })
}

function buildInlineSummary(log: NormalizedAuditLog): string {
  const diffs = computeFieldDiffs(log.old_values, log.new_values)
  const interesting = diffs.filter((d) => d.kind !== "UNCHANGED")
  const pick = (interesting.length > 0 ? interesting : diffs).slice(0, 3)

  if (pick.length === 0) {
    return `Đối tượng ${log.entity_id.slice(0, 8)}...`
  }

  return pick
    .map((d) => {
      if (d.kind === "CHANGED") {
        return `${d.label}: ${formatFieldValue(d.key, d.oldVal)} → ${formatFieldValue(
          d.key,
          d.newVal
        )}`
      }
      if (d.kind === "REMOVED") {
        return `Xóa ${d.label}: ${formatFieldValue(d.key, d.oldVal)}`
      }
      return `${d.label}: ${formatFieldValue(d.key, d.newVal)}`
    })
    .join(" • ")
}

function csvEscape(value: string): string {
  return escapeCsvCell(value)
}

export function AuditLogViewer() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const { canViewAuditLogs } = useWorkspaceRole()
  const canQueryRealApi = isAuthenticated && !isAuthLoading

  const [page, setPage] = React.useState(1)
  const [searchInput, setSearchInput] = React.useState("")
  const [entityFilter, setEntityFilter] = React.useState("ALL")
  const [actionFilter, setActionFilter] = React.useState("ALL")
  const [fromDate, setFromDate] = React.useState("")
  const [toDate, setToDate] = React.useState("")
  const [onlySensitive, setOnlySensitive] = React.useState(false)

  const [selectedLog, setSelectedLog] = React.useState<NormalizedAuditLog | null>(null)
  const [detailTab, setDetailTab] = React.useState<"diff" | "json">("diff")
  const [onlyChangedFields, setOnlyChangedFields] = React.useState(false)

  const limit = 15

  const apiAuditQuery = useGetApiV1AuditLogs(
    {
      page,
      limit,
      search: searchInput.trim() || undefined,
      entity_name: entityFilter !== "ALL" ? entityFilter : undefined,
      action: actionFilter !== "ALL" ? actionFilter : undefined,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    },
    {
      query: {
        enabled: canQueryRealApi && canViewAuditLogs,
      },
    }
  )

  const visibleItems = React.useMemo<NormalizedAuditLog[]>(() => {
    const raw = apiAuditQuery.data?.data?.items || []
    const mapped = raw.map((item) => ({
      audit_log_id: item.audit_log_id || "",
      entity_name: item.entity_name || "unknown",
      entity_id: item.entity_id || "",
      action: item.action || "",
      old_values: (item.old_values as Record<string, unknown> | null) || null,
      new_values: (item.new_values as Record<string, unknown> | null) || null,
      changed_by: item.changed_by || null,
      actor_username: item.actor_username || "system",
      actor_full_name: item.actor_full_name || "Hệ thống tự động",
      actor_role: item.actor_role || "SYSTEM",
      created_at: item.created_at || "",
    }))
    return onlySensitive
      ? mapped.filter((m) => SENSITIVE_ACTIONS.has(m.action))
      : mapped
  }, [apiAuditQuery.data, onlySensitive])

  const pagination = React.useMemo(() => {
    const p = apiAuditQuery.data?.data?.pagination
    return {
      page: p?.page || page,
      limit: p?.limit || limit,
      total: p?.total || 0,
      totalPages: p?.totalPages || 1,
    }
  }, [apiAuditQuery.data, page, limit])

  const summary = React.useMemo(() => {
    const s = apiAuditQuery.data?.data?.summary
    return {
      total: s?.total || 0,
      todayCount: s?.today_count || 0,
      sensitiveCount: s?.sensitive_count || 0,
      uniqueActorsCount: s?.unique_actors_count || 0,
    }
  }, [apiAuditQuery.data])

  const hasActiveFilters = Boolean(
    searchInput.trim() ||
      entityFilter !== "ALL" ||
      actionFilter !== "ALL" ||
      fromDate ||
      toDate ||
      onlySensitive
  )

  const handleResetFilters = () => {
    setSearchInput("")
    setEntityFilter("ALL")
    setActionFilter("ALL")
    setFromDate("")
    setToDate("")
    setOnlySensitive(false)
    setPage(1)
  }

  const handleExportCsv = () => {
    const sourceRows = visibleItems
    if (sourceRows.length === 0) {
      toast.info("Không có bản ghi nào để xuất CSV")
      return
    }
    const headers = [
      "Thời gian",
      "Người thực hiện",
      "Username",
      "Vai trò",
      "Phân hệ",
      "Hành động",
      "Mã đối tượng",
      "Tóm tắt thay đổi",
      "Giá trị cũ (JSON)",
      "Giá trị mới (JSON)",
    ]
    const csvLines = [
      headers.map(csvEscape).join(","),
      ...sourceRows.map((row) =>
        [
          formatDateTimeVi(row.created_at),
          row.actor_full_name,
          row.actor_username,
          row.actor_role,
          ENTITY_META[row.entity_name]?.label || row.entity_name,
          ACTION_META[row.action]?.label || row.action,
          row.entity_id,
          buildInlineSummary(row),
          row.old_values ? JSON.stringify(row.old_values) : "",
          row.new_values ? JSON.stringify(row.new_values) : "",
        ]
          .map(csvEscape)
          .join(",")
      ),
    ]
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `nhat-ky-kiem-toan-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`Đã xuất ${sourceRows.length} bản ghi nhật ký kiểm toán ra file CSV!`)
  }

  if (isAuthLoading) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Đang kiểm tra quyền truy cập Nhật ký Kiểm toán...
      </div>
    )
  }

  if (!canViewAuditLogs) {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconShieldCheck className="size-5 text-amber-600" />
              Giới hạn quyền truy cập (BOD / ADMIN / Kế toán)
            </CardTitle>
            <CardDescription>
              Tài khoản &ldquo;{user?.username}&rdquo; ({user?.role}) không có quyền xem Nhật ký Kiểm toán toàn hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button asChild variant="outline">
              <FastLink href="/">
                <IconArrowLeft className="size-4 mr-1.5" />
                Quay lại Tổng quan
              </FastLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedDiffs = selectedLog
    ? computeFieldDiffs(selectedLog.old_values, selectedLog.new_values)
    : []
  const displayedDiffs = onlyChangedFields
    ? selectedDiffs.filter((d) => d.kind !== "UNCHANGED")
    : selectedDiffs

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
              <IconHistory className="size-6 text-primary" />
              Tra cứu Nhật ký Kiểm toán
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Lưu vết toàn bộ biến động Hợp đồng, 4 chỉ số Mốc, Mở lại Mốc (Reopen), Thu tiền / VAT, Thực chi thưởng 50%, Khách hàng & Phân quyền.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            disabled={apiAuditQuery.isFetching}
            onClick={() => apiAuditQuery.refetch()}
          >
            <IconRefresh
              className={cn("size-3.5", apiAuditQuery.isFetching && "animate-spin")}
            />
            Làm mới
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs bg-white"
            onClick={handleExportCsv}
          >
            <IconDownload className="size-3.5" />
            Xuất CSV (Excel)
          </Button>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Tổng bản ghi khớp bộ lọc
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {summary.total.toLocaleString("vi-VN")}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Mọi thao tác ghi vết không thể sửa xóa
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500">
            Sự kiện phát sinh hôm nay
          </div>
          <div className="text-2xl font-bold tabular-nums text-primary mt-1">
            {summary.todayCount.toLocaleString("vi-VN")}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Tính từ 00:00 ngày hiện tại
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
          <div className="text-xs font-medium text-amber-900 flex items-center gap-1.5">
            <IconAlertTriangle className="size-3.5 text-amber-600" />
            Thao tác trọng yếu / Tài chính
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-900 mt-1">
            {summary.sensitiveCount.toLocaleString("vi-VN")}
          </div>
          <div className="text-xs text-amber-800/80 mt-1">
            Chi thưởng 50%, PAID, Reopen, Đóng DA, Khóa/Xóa
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
            <IconUserCheck className="size-3.5 text-slate-400" />
            Nhân sự phát sinh thao tác
          </div>
          <div className="text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {summary.uniqueActorsCount.toLocaleString("vi-VN")}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Số tài khoản có hoạt động trong phạm vi lọc
          </div>
        </div>
      </div>

      {/* Bộ lọc đa chiều */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <IconSearch className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm mã HĐ, Mốc, tên nhân sự, nội dung thay đổi..."
              className="pl-9 pr-8 h-9 text-sm bg-white border-slate-200"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => {
                  setSearchInput("")
                  setPage(1)
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            <Select
              value={entityFilter}
              onValueChange={(v) => {
                setEntityFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 text-sm bg-white border-slate-200">
                <SelectValue placeholder="Phân hệ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Mọi phân hệ</SelectItem>
                {Object.entries(ENTITY_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Select
              value={actionFilter}
              onValueChange={(v) => {
                setActionFilter(v)
                setPage(1)
              }}
            >
              <SelectTrigger className="h-9 text-sm bg-white border-slate-200">
                <SelectValue placeholder="Hành động" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Mọi hành động</SelectItem>
                {Object.entries(ACTION_META).map(([key, meta]) => (
                  <SelectItem key={key} value={key}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                setPage(1)
              }}
              aria-label="Từ ngày"
              title="Từ ngày"
              className="h-9 text-sm bg-white border-slate-200"
            />
          </div>

          <div className="md:col-span-2">
            <Input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                setPage(1)
              }}
              aria-label="Đến ngày"
              title="Đến ngày"
              className="h-9 text-sm bg-white border-slate-200"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOnlySensitive((prev) => !prev)
                setPage(1)
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                onlySensitive
                  ? "border-amber-300 bg-amber-100 text-amber-950"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              )}
            >
              <IconAlertTriangle className="size-3.5" />
              Chỉ xem thao tác trọng yếu / tài chính
            </button>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-7 px-2.5 text-xs text-slate-600 hover:text-slate-900 gap-1"
            >
              <IconFilterOff className="size-3.5" />
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </div>

      {/* Bảng Nhật ký Kiểm toán */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 font-medium">Thời gian</th>
                <th className="py-3 px-3 font-medium">Người thực hiện</th>
                <th className="py-3 px-3 font-medium">Phân hệ</th>
                <th className="py-3 px-3 font-medium">Hành động</th>
                <th className="py-3 px-3 font-medium">Tóm tắt thay đổi</th>
                <th className="py-3 pl-3 pr-5 text-right font-medium">So sánh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {apiAuditQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Đang tải Nhật ký Kiểm toán từ máy chủ...
                  </td>
                </tr>
              ) : apiAuditQuery.isError ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-rose-600 text-sm">
                    Không thể tải dữ liệu Nhật ký Kiểm toán. Vui lòng kiểm tra kết nối PostgreSQL hoặc bấm Làm mới.
                  </td>
                </tr>
              ) : visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    Không có bản ghi kiểm toán nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                visibleItems.map((log) => {
                  const entityMeta = ENTITY_META[log.entity_name] || {
                    label: log.entity_name,
                    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
                  }
                  const actionLabel = ACTION_META[log.action]?.label || log.action
                  const isSensitive = SENSITIVE_ACTIONS.has(log.action)
                  const inlineSummary = buildInlineSummary(log)

                  return (
                    <tr
                      key={log.audit_log_id}
                      onClick={() => {
                        setSelectedLog(log)
                        setDetailTab("diff")
                      }}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors group"
                    >
                      <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-slate-600 whitespace-nowrap tabular-nums">
                        {formatDateTimeVi(log.created_at)}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <PersonAvatar name={log.actor_full_name} />
                          <div>
                            <div className="font-medium text-slate-900 leading-tight">
                              {log.actor_full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>@{log.actor_username}</span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-700">
                                {log.actor_role}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                            entityMeta.badgeClass
                          )}
                        >
                          {entityMeta.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-semibold",
                            getActionBadgeClass(log.action)
                          )}
                        >
                          {isSensitive && <IconAlertTriangle className="size-3 shrink-0" />}
                          {actionLabel}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 max-w-md">
                        <div
                          className="text-xs text-slate-700 truncate"
                          title={inlineSummary}
                        >
                          {inlineSummary}
                        </div>
                      </td>

                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 group-hover:text-primary">
                          Chi tiết
                          <IconArrowRight className="size-3.5" />
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100">
          <StandardPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.total}
            limit={pagination.limit}
            onPageChange={setPage}
            isLoading={apiAuditQuery.isFetching}
            unit="bản ghi"
          />
        </div>
      </div>

      {/* Slide-over Drawer Chi tiết So sánh Trước / Sau */}
      <Sheet open={Boolean(selectedLog)} onOpenChange={(o) => !o && setSelectedLog(null)}>
        <SheetContent className="w-full sm:!max-w-2xl overflow-y-auto p-6">
          {selectedLog && (
            <div className="space-y-5 pb-6">
              <SheetHeader className="p-0 border-b border-slate-200 pb-4 pr-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-medium",
                      (ENTITY_META[selectedLog.entity_name] || {
                        badgeClass: "bg-slate-100 text-slate-700",
                      }).badgeClass
                    )}
                  >
                    {ENTITY_META[selectedLog.entity_name]?.label || selectedLog.entity_name}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-semibold",
                      getActionBadgeClass(selectedLog.action)
                    )}
                  >
                    {ACTION_META[selectedLog.action]?.label || selectedLog.action}
                  </Badge>
                </div>
                <SheetTitle className="text-lg font-bold text-slate-900 mt-1.5">
                  Chi tiết Biến động Kiểm toán
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500">
                  Thời điểm: <strong className="text-slate-800">{formatDateTimeVi(selectedLog.created_at)}</strong> • Thực hiện bởi:{" "}
                  <strong className="text-slate-800">
                    {selectedLog.actor_full_name} (@{selectedLog.actor_username} — {selectedLog.actor_role})
                  </strong>
                </SheetDescription>
              </SheetHeader>

              {/* Metadata ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500">Mã đối tượng (Entity ID)</div>
                    <div className="font-mono text-slate-900 truncate mt-0.5">
                      {selectedLog.entity_id}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 shrink-0"
                    onClick={() => {
                      navigator.clipboard?.writeText(selectedLog.entity_id)
                      toast.success("Đã sao chép Entity ID")
                    }}
                  >
                    <IconCopy className="size-3.5" />
                  </Button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-500">Mã hành động gốc (Action)</div>
                    <div className="font-mono font-semibold text-slate-900 truncate mt-0.5">
                      {selectedLog.action}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 shrink-0"
                    onClick={() => {
                      navigator.clipboard?.writeText(selectedLog.audit_log_id)
                      toast.success("Đã sao chép Audit Log ID")
                    }}
                  >
                    <IconCopy className="size-3.5" />
                  </Button>
                </div>
              </div>

              {/* Tab Switcher: Diff vs Raw JSON */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDetailTab("diff")}
                    className={cn(
                      "rounded-md px-3 py-1 font-medium transition-colors",
                      detailTab === "diff"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    So sánh Trước ↔ Sau ({selectedDiffs.length} trường)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailTab("json")}
                    className={cn(
                      "rounded-md px-3 py-1 font-medium transition-colors",
                      detailTab === "json"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    JSON gốc
                  </button>
                </div>

                {detailTab === "diff" && (
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyChangedFields}
                      onChange={(e) => setOnlyChangedFields(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Chỉ hiện trường có thay đổi
                  </label>
                )}
              </div>

              {detailTab === "diff" ? (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                        <th className="py-2.5 pl-3.5 pr-2 font-medium w-1/3">Trường dữ liệu</th>
                        <th className="py-2.5 px-2 font-medium w-1/3">Giá trị trước</th>
                        <th className="py-2.5 pl-2 pr-3.5 font-medium w-1/3">Giá trị sau</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedDiffs.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-500">
                            Không có trường dữ liệu chi tiết nào được ghi nhận cho hành động này.
                          </td>
                        </tr>
                      ) : (
                        displayedDiffs.map((d) => (
                          <tr
                            key={d.key}
                            className={cn(
                              d.kind === "CHANGED" && "bg-amber-50/40",
                              d.kind === "ADDED" && "bg-emerald-50/40",
                              d.kind === "REMOVED" && "bg-rose-50/40"
                            )}
                          >
                            <td className="py-2.5 pl-3.5 pr-2 align-top">
                              <div className="font-semibold text-slate-800">{d.label}</div>
                              <div className="font-mono text-[10px] text-slate-400">
                                {d.key}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 align-top text-slate-600 break-words">
                              {formatFieldValue(d.key, d.oldVal)}
                            </td>
                            <td className="py-2.5 pl-2 pr-3.5 align-top font-medium text-slate-900 break-words">
                              {formatFieldValue(d.key, d.newVal)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700">
                        old_values (Trước khi thay đổi)
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            JSON.stringify(selectedLog.old_values, null, 2)
                          )
                          toast.success("Đã sao chép old_values JSON")
                        }}
                      >
                        <IconCopy className="size-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] overflow-x-auto text-slate-700 max-h-60">
                      {JSON.stringify(selectedLog.old_values, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-700">
                        new_values (Sau khi thay đổi)
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          navigator.clipboard?.writeText(
                            JSON.stringify(selectedLog.new_values, null, 2)
                          )
                          toast.success("Đã sao chép new_values JSON")
                        }}
                      >
                        <IconCopy className="size-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] overflow-x-auto text-slate-900 max-h-60">
                      {JSON.stringify(selectedLog.new_values, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
