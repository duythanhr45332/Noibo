"use client"

import * as React from "react"
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconCopy,
  IconFolder,
  IconPlus,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/components/providers/auth-provider"
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider"
import {
  useWorkspaceContracts,
  useWorkspaceRole,
} from "@/lib/hooks/use-workspace-data"
import {
  calculateContractMetrics,
  ContractProject,
  getMilestoneFourMetrics,
} from "@/lib/mock/am-types"
import { cn } from "@/lib/utils"

/**
 * Vòng tròn tiến độ Donut Ring chuẩn Productive.io (20x20 SVG)
 */
export function ProductiveDonutRing({
  percent,
  isOverLimit = false,
  isWarning = false,
}: {
  percent: number
  isOverLimit?: boolean
  isWarning?: boolean
}) {
  const clamped = Math.max(0, Math.min(100, percent))
  const r = 7.5
  const c = 2 * Math.PI * r
  const offset = c - (clamped / 100) * c

  const strokeColor = isOverLimit
    ? "#DC2626" // red-600
    : isWarning
      ? "#D97706" // amber-600
      : "#10B981" // emerald-500

  return (
    <svg className="size-5 -rotate-90 shrink-0" viewBox="0 0 20 20">
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="transparent"
        stroke="#E2E8F0"
        strokeWidth="2.5"
      />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="transparent"
        stroke={strokeColor}
        strokeWidth="2.5"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Thanh thước nhiệt Bullet-Chart chuẩn Swiss Financial Triage Cockpit:
 * Hiển thị trực quan Thực tiêu (Real) so với vạch Mức giao PM (Target) trên toàn chiều dài Trần tối đa (Limit)
 */
export function MandayBulletBar({
  realMd,
  targetMd,
  limitMd,
}: {
  realMd: number
  targetMd: number
  limitMd: number
}) {
  const safeLimit = Math.max(1, limitMd)
  const fillPct = Math.max(0, Math.min(100, Math.round((realMd / safeLimit) * 100)))
  const targetMarkerPct = Math.max(
    0,
    Math.min(100, Math.round((targetMd / safeLimit) * 100))
  )
  const isOverLimit = realMd > limitMd
  const isOverTarget = !isOverLimit && realMd > targetMd

  return (
    <div
      className="relative h-2 w-20 rounded-full bg-slate-200/90 overflow-hidden shrink-0"
      title={`Thực tiêu: ${realMd} MD / Mức giao PM: ${targetMd} MD / Trần tối đa: ${limitMd} MD`}
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          isOverLimit
            ? "bg-red-600"
            : isOverTarget
              ? "bg-amber-500"
              : "bg-primary"
        )}
        style={{ width: `${fillPct}%` }}
      />
      {targetMarkerPct > 0 && targetMarkerPct < 100 && (
        <span
          className="absolute top-0 bottom-0 w-[2px] bg-slate-900/70"
          style={{ left: `${targetMarkerPct}%` }}
        />
      )}
    </div>
  )
}

/**
 * Avatar tròn chuẩn Productive.io (24x24, chữ rõ ràng)
 */
export function PersonAvatar({ name }: { name: string }) {
  const initials = name
    .replace(/\(.*\)/, "")
    .trim()
    .split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()

  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">
      {initials || "AM"}
    </span>
  )
}

const REAL_MANUAL_TASKS_KEY = "erp_am_real_manual_tasks_v1"

export function ProductiveHomeDashboard() {
  const { user } = useAuth()
  const { contracts, isLoading: isContractsLoading } =
    useWorkspaceContracts({ includeDetails: true })
  const { isPmRole } = useWorkspaceRole()
  const roleView = isPmRole ? "PM" : "AM"

  const {
    formatMoney,
    formatCompactMoney,
    openContractDetail,
    setActiveScreen,
  } = useWorkspaceUi()

  // Chế độ lọc ở trang Tổng quan: Mặc định chỉ hiện các Dự án & Mốc bàn giao đang chạy
  const [onlyRunningInHome, setOnlyRunningInHome] = React.useState<boolean>(true)
  const [onlyRiskContracts, setOnlyRiskContracts] = React.useState<boolean>(false)

  // Mở rộng sẵn các dòng Dự án đang chạy
  const [expandedContracts, setExpandedContracts] = React.useState<
    Record<string, boolean>
  >(() => {
    const init: Record<string, boolean> = {}
    contracts.forEach((c) => {
      init[c.id] = c.phase === "IN_PROJECT"
    })
    return init
  })

  // Khi danh sách hợp đồng thay đổi (từ PostgreSQL), tự mở các dự án đang chạy
  React.useEffect(() => {
    setExpandedContracts((prev) => {
      const next = { ...prev }
      let changed = false
      contracts.forEach((c) => {
        if (next[c.id] === undefined) {
          next[c.id] = c.phase === "IN_PROJECT"
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [contracts])

  // Danh sách việc nhắc riêng do AM tự thêm (lưu cá nhân trên trình duyệt)
  const [manualTasks, setManualTasks] = React.useState<
    Array<{
      id: string
      contractId: string // "GENERAL" hoặc id dự án
      label: string
      assignee: string
      done: boolean
    }>
  >([])

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(REAL_MANUAL_TASKS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          setManualTasks(parsed)
          return
        }
      }
    } catch {
      // Ignore storage error
    }
    setManualTasks([])
  }, [])

  React.useEffect(() => {
    try {
      window.localStorage.setItem(REAL_MANUAL_TASKS_KEY, JSON.stringify(manualTasks))
    } catch {
      // Ignore storage error
    }
  }, [manualTasks])

  const [isAddingTask, setIsAddingTask] = React.useState(false)
  const [newTaskContractId, setNewTaskContractId] = React.useState<string>(
    contracts[0]?.id || "GENERAL"
  )
  const [newTaskLabel, setNewTaskLabel] = React.useState("")
  const [newTaskAssignee, setNewTaskAssignee] = React.useState(
    user?.full_name || "AM"
  )

  React.useEffect(() => {
    setNewTaskContractId((prev) => {
      if (prev === "GENERAL") return prev
      if (contracts.some((c) => c.id === prev)) return prev
      return contracts[0]?.id || "GENERAL"
    })
  }, [contracts])

  const handleAddManualTask = () => {
    if (!newTaskLabel.trim()) {
      toast.error("Vui lòng nhập nội dung công việc cần nhắc")
      return
    }
    setManualTasks((prev) => [
      {
        id: `manual-${Date.now()}`,
        contractId: newTaskContractId,
        label: newTaskLabel.trim(),
        assignee: newTaskAssignee,
        done: false,
      },
      ...prev,
    ])
    setNewTaskLabel("")
    setIsAddingTask(false)
    toast.success("Đã thêm việc nhắc riêng vào danh sách!")
  }

  const toggleManualTaskDone = (taskId: string) => {
    setManualTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t))
    )
  }

  const removeManualTask = (taskId: string) => {
    setManualTasks((prev) => prev.filter((t) => t.id !== taskId))
    toast.success("Đã xóa việc nhắc riêng")
  }

  const toggleExpand = (contractId: string) => {
    setExpandedContracts((prev) => ({
      ...prev,
      [contractId]: !prev[contractId],
    }))
  }

  // Tính dòng TỔNG CỘNG cho bảng Sổ cái ngân sách
  const grandTotals = React.useMemo(() => {
    let totalRevenue = 0
    let totalLimitMd = 0
    let totalTargetMd = 0
    let totalEstMd = 0
    let totalRealMd = 0
    let totalBonus50Vnd = 0
    let totalFreeSupportRealMd = 0
    let totalFreeSupportCount = 0
    let bleedingContractCount = 0
    let totalActionableDebtVnd = 0
    let actionableInstallmentCount = 0

    contracts.forEach((c) => {
      const m = calculateContractMetrics(c)
      totalRevenue += m.totalContractValue
      totalLimitMd += m.totalMaxMandays
      totalTargetMd += m.effectiveTargetMandays
      totalEstMd += m.effectiveEstimateMandays
      totalRealMd += m.effectiveRealMandays
      totalBonus50Vnd += m.kpiBonusAmountVnd
      totalFreeSupportRealMd += m.totalFreeSupportRealMd
      totalFreeSupportCount += m.totalFreeSupportCount

      if (m.isOverLimit || m.effectiveRealMandays > m.effectiveTargetMandays) {
        bleedingContractCount += 1
      }
      if (m.actionableDebtAmount > 0) {
        totalActionableDebtVnd += m.actionableDebtAmount
      }
      actionableInstallmentCount +=
        m.readyToBillInstallments.length +
        c.installments.filter((i) => i.paymentStatus === "OVERDUE").length
    })

    const remainingMd = totalLimitMd - totalRealMd
    const burnPct =
      totalLimitMd > 0 ? Math.round((totalRealMd / totalLimitMd) * 100) : 0

    return {
      totalRevenue,
      totalLimitMd,
      totalTargetMd,
      totalEstMd,
      totalRealMd,
      remainingMd,
      burnPct,
      totalBonus50Vnd,
      totalFreeSupportRealMd,
      totalFreeSupportCount,
      bleedingContractCount,
      totalActionableDebtVnd,
      actionableInstallmentCount,
    }
  }, [contracts])

  const handleCopyProjectGoodwillEvidence = (contract: ContractProject) => {
    const freeCrs = contract.changeRequests.filter(
      (cr) =>
        cr.crType === "FREE_SUPPORT" || cr.status === "APPROVED_FREE_GOODWILL"
    )
    if (freeCrs.length === 0) {
      toast.info("Dự án này chưa có khoản hỗ trợ 0đ nào.")
      return
    }
    const totalRealDays = freeCrs.reduce(
      (sum, cr) => sum + cr.pmEstimatedMandays,
      0
    )
    const lines = freeCrs.map(
      (cr, idx) =>
        `${idx + 1}. ${cr.title} (${cr.requestedDate}): ${cr.devMandays ?? cr.pmEstimatedMandays} MD hỗ trợ 0đ (1:1 • Tách cột riêng)`
    )
    const body = `Kính gửi Quý khách hàng ${contract.customerName},\nDự án: ${contract.projectName} (${contract.contractCode})\n\nTrong quá trình triển khai vừa qua, bên em đã ưu tiên hỗ trợ miễn phí (0 đồng) cho Quý khách ${freeCrs.length} hạng mục phát sinh ngoài phạm vi hợp đồng (tổng cộng ${totalRealDays} ngày công thực tế):\n${lines.join("\n")}\n\nRất mong Anh/Chị hỗ trợ bên em hoàn tất nghiệm thu / thanh toán đợt tiếp theo và ký phụ lục cho các tính năng mở rộng lớn. Trân trọng cảm ơn Anh/Chị!`
    navigator.clipboard?.writeText(body)
    toast.success(
      `Đã sao chép bằng chứng hỗ trợ 0đ của khách "${contract.customerName}"!`
    )
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* MAIN CANVAS (Swiss Financial Triage Cockpit) */}
      <div className="px-6 lg:px-8 py-6 w-full space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Buồng lái Kiểm soát Ngày công & Dòng tiền Dự án
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Phát hiện tức thì dự án vượt ngưỡng Manday, đợt thanh toán cần đòi nợ hôm nay và sổ bằng chứng hỗ trợ 0đ
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1">
              <span className="size-2 rounded-full bg-primary" />
              Thực tiêu &lt; Target
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1">
              <span className="size-2 rounded-full bg-amber-500" />
              Vượt Target PM
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white border border-slate-200 px-2.5 py-1">
              <span className="size-2 rounded-full bg-red-600" />
              Vượt Trần Limit
            </span>
          </div>
        </div>

        {/* =====================================================================
            TẦNG 1: DẢI TRIAGE KHẨN CẤP 5-GIÂY (SWISS 3-COLUMN SEGMENTED STRIP)
           ===================================================================== */}
        <div className="rounded-xl border border-slate-200 bg-white grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 overflow-hidden">
          {/* Ô 1: Cảnh báo Chảy máu Ngày công */}
          <div className="p-5 flex flex-col justify-between gap-3 bg-red-50/35">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-red-700">
                  1. Cảnh báo vượt ngưỡng ngày công
                </div>
                <div className="text-2xl font-bold tabular-nums text-red-700 mt-1 tracking-tight">
                  {grandTotals.bleedingContractCount} hợp đồng{" "}
                  <span className="text-sm font-medium text-slate-700">
                    cần kiểm soát
                  </span>
                </div>
              </div>
              <span className="rounded-md bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 text-xs font-semibold tabular-nums">
                Đã tiêu {grandTotals.burnPct}% tổng quỹ
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-red-200/60 text-xs">
              <span className="text-slate-600">
                Tổng thực tiêu:{" "}
                <strong className="tabular-nums text-slate-900">
                  {grandTotals.totalRealMd}/{grandTotals.totalLimitMd} MD
                </strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setOnlyRiskContracts((prev) => !prev)
                  setOnlyRunningInHome(false)
                }}
                className={cn(
                  "font-semibold px-2.5 py-1 rounded-md transition-colors",
                  onlyRiskContracts
                    ? "bg-red-700 text-white"
                    : "bg-white text-red-700 border border-red-200 hover:bg-red-50"
                )}
              >
                {onlyRiskContracts
                  ? "✓ Đang lọc dự án nguy cơ"
                  : "Lọc dự án nguy cơ ↓"}
              </button>
            </div>
          </div>

          {/* Ô 2: Cổng Thu tiền & Xuất VAT hôm nay */}
          <div className="p-5 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-amber-800">
                  2. Đợt thanh toán cần đòi ngay
                </div>
                <div className="text-2xl font-bold tabular-nums text-slate-900 mt-1 tracking-tight">
                  {roleView === "PM"
                    ? `${grandTotals.actionableInstallmentCount} đợt đến hạn`
                    : formatCompactMoney(grandTotals.totalActionableDebtVnd)}
                </div>
              </div>
              <span className="rounded-md bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-xs font-semibold tabular-nums">
                {grandTotals.actionableInstallmentCount} đợt mở khóa
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
              <span className="text-slate-600">
                Mốc bàn giao đã xong hoặc quá hạn thu nợ
              </span>
              <button
                type="button"
                onClick={() => setActiveScreen("billing-vat")}
                className="font-semibold text-primary hover:underline"
              >
                Mở sổ Đòi tiền & VAT →
              </button>
            </div>
          </div>

          {/* Ô 3: Quỹ Thưởng 50/50 & Đòn bẩy Hỗ trợ 0đ */}
          <div className="p-5 flex flex-col justify-between gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-emerald-800">
                  3. Quỹ thưởng 50/50 & Bằng chứng 0đ
                </div>
                <div className="text-2xl font-bold tabular-nums text-emerald-700 mt-1 tracking-tight">
                  {roleView === "PM"
                    ? `+${grandTotals.remainingMd} MD dư`
                    : `+${formatCompactMoney(grandTotals.totalBonus50Vnd)}`}
                </div>
              </div>
              <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-xs font-semibold tabular-nums">
                +{grandTotals.totalFreeSupportRealMd} MD hỗ trợ 0đ
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
              <span className="text-slate-600">
                Đã miễn phí{" "}
                <strong className="tabular-nums text-slate-900">
                  {grandTotals.totalFreeSupportCount} lần
                </strong>{" "}
                ngoài phạm vi HĐ
              </span>
              <button
                type="button"
                onClick={() => setActiveScreen("am-tasks")}
                className="font-semibold text-primary hover:underline"
              >
                Mở Action Inbox →
              </button>
            </div>
          </div>
        </div>

        {/* HÀNG TRÊN: 2 KHỐI RỘNG RÃI (8 CỘT VIỆC CẦN XỬ LÝ CỦA AM | 4 CỘT GHI CHÚ & BẰNG CHỨNG 0Đ) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* KHỐI 1 (8 CỘT): VIỆC CẦN XỬ LÝ HÔM NAY (TỰ ĐỘNG QUÉT + AM TỰ THÊM) */}
          <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Việc cần xử lý của AM
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tự động quét từ dự án & việc nhắc riêng của AM
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingTask((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors shrink-0"
              >
                <IconPlus className="size-3.5" />
                <span>Thêm việc nhắc riêng</span>
              </button>
            </div>

            {/* Khung thêm nhanh việc nhắc riêng */}
            {isAddingTask && (
              <div className="mb-4 rounded-lg bg-slate-50 p-3.5 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Thuộc Dự án
                    </label>
                    <select
                      value={newTaskContractId}
                      onChange={(e) => setNewTaskContractId(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="GENERAL">📌 Việc chung của AM</option>
                      {contracts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.contractCode.split("/")[0]} — {c.projectName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Người phụ trách
                    </label>
                    <select
                      value={newTaskAssignee}
                      onChange={(e) => setNewTaskAssignee(e.target.value)}
                      className="w-full h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none"
                    >
                      <option value="Thảo (AM)">Thảo (AM)</option>
                      <option value="Chị Giang (PM Tổng)">Chị Giang (PM Tổng)</option>
                      <option value="Minh Quân (Tech PM)">Minh Quân (Tech PM)</option>
                      <option value="Hoàng Nam (Tech PM)">Hoàng Nam (Tech PM)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Input
                    value={newTaskLabel}
                    onChange={(e) => setNewTaskLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddManualTask()
                    }}
                    placeholder="Nhập việc cần làm (VD: Gọi khách xác nhận biên bản nghiệm thu...)"
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingTask(false)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/60"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualTask}
                    className="rounded-md bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 text-xs font-semibold"
                  >
                    Lưu việc
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[13px] text-slate-500 font-medium">
                    <th className="pb-2.5 font-medium">Nội dung công việc</th>
                    <th className="pb-2.5 font-medium w-32">Phân loại</th>
                    <th className="pb-2.5 font-medium w-44">Người phụ trách</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {/* Nhóm việc chung của AM (nếu có) */}
                  {manualTasks.some((mt) => mt.contractId === "GENERAL") && (
                    <React.Fragment>
                      <tr className="bg-slate-50/70">
                        <td colSpan={3} className="py-2 px-2.5">
                          <span className="font-semibold text-xs text-slate-700">
                            📌 Việc nhắc chung của AM
                          </span>
                        </td>
                      </tr>
                      {manualTasks
                        .filter((mt) => mt.contractId === "GENERAL")
                        .map((mt) => (
                          <tr
                            key={mt.id}
                            className="hover:bg-slate-50 group"
                          >
                            <td className="py-3 pl-4 pr-3">
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={mt.done}
                                  onChange={() => toggleManualTaskDone(mt.id)}
                                  className="mt-1 size-4 rounded border-slate-300 accent-slate-900 cursor-pointer"
                                />
                                <span
                                  onClick={() => toggleManualTaskDone(mt.id)}
                                  className={cn(
                                    "cursor-pointer",
                                    mt.done
                                      ? "line-through text-slate-400"
                                      : "text-slate-800"
                                  )}
                                >
                                  {mt.label}
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              <span
                                className={cn(
                                  "inline-block rounded-md px-2.5 py-0.5 text-xs font-medium",
                                  mt.done
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-700"
                                )}
                              >
                                {mt.done ? "Đã xong" : "Tự nhắc"}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center justify-between gap-2 text-slate-700">
                                <div className="flex items-center gap-2 truncate">
                                  <PersonAvatar name={mt.assignee} />
                                  <span className="truncate text-[13px]">
                                    {mt.assignee.split("(")[0].trim()}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeManualTask(mt.id)}
                                  className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-red-600 px-1"
                                  title="Xóa việc nhắc này"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </React.Fragment>
                  )}

                  {contracts.map((contract) => {
                    const m = calculateContractMetrics(contract)
                    const tasks: Array<{
                      id: string
                      label: string
                      statusLabel: string
                      statusClass: string
                      assignee: string
                      onClick: () => void
                    }> = []

                    const runningMs =
                      contract.scopeItems.find(
                        (s) => s.status !== "COMPLETED" && !s.isAccepted
                      ) || contract.scopeItems[0]

                    if (m.isCheckInOverdue && runningMs) {
                      tasks.push({
                        id: `${contract.id}-log`,
                        label: `Cập nhật ngày công định kỳ ${runningMs.code} (Quá ${m.daysSinceLastCheck} ngày)`,
                        statusLabel: "Đang chờ",
                        statusClass: "bg-slate-100 text-slate-700",
                        assignee: runningMs.ownerPic || contract.pmOwner,
                        onClick: () => openContractDetail(contract.id),
                      })
                    }

                    if (
                      m.readyToBillInstallments.length > 0 ||
                      m.overdueAmount > 0
                    ) {
                      const inst =
                        m.readyToBillInstallments[0] ||
                        contract.installments.find(
                          (i) => i.paymentStatus === "OVERDUE"
                        )
                      tasks.push({
                        id: `${contract.id}-bill`,
                        label: `Đòi tiền ${inst?.name.split(":")[0] || "Đợt TT"} (${formatCompactMoney(inst?.amount || m.overdueAmount)})`,
                        statusLabel: "Thu tiền",
                        statusClass: "bg-amber-50 text-amber-800 border border-amber-200/70",
                        assignee: "Thảo (AM)",
                        onClick: () => setActiveScreen("billing-vat"),
                      })
                    }

                    if (
                      contract.phase === "PRE_PROJECT" &&
                      !m.kickoffEval.isAllChecklistReady
                    ) {
                      tasks.push({
                        id: `${contract.id}-kickoff`,
                        label: `Hoàn tất danh mục khởi động (${m.kickoffEval.completedCount}/4 mục)`,
                        statusLabel: "Chuẩn bị",
                        statusClass: "bg-slate-100 text-slate-700",
                        assignee: "Thảo (AM)",
                        onClick: () => openContractDetail(contract.id),
                      })
                    }

                    if (m.isOverLimit) {
                      tasks.push({
                        id: `${contract.id}-over`,
                        label: `Vượt trần tối đa (${m.surplusMandays} ngày)`,
                        statusLabel: "Vượt trần",
                        statusClass: "bg-red-50 text-red-700 border border-red-200/70",
                        assignee: contract.pmOwner,
                        onClick: () => openContractDetail(contract.id),
                      })
                    }

                    const projectManualTasks = manualTasks.filter(
                      (mt) => mt.contractId === contract.id
                    )

                    if (tasks.length === 0 && projectManualTasks.length === 0)
                      return null

                    return (
                      <React.Fragment key={contract.id}>
                        {/* Dòng Cha: Tên Dự án */}
                        <tr
                          onClick={() => openContractDetail(contract.id)}
                          className="bg-slate-50/70 hover:bg-slate-100/70 cursor-pointer"
                        >
                          <td colSpan={3} className="py-2.5 px-2.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-500">
                                {contract.contractCode.split("/")[0]}
                              </span>
                              <span className="font-semibold text-slate-900">
                                {contract.projectName}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Các dòng Con: Hệ thống tự động quét */}
                        {tasks.map((t) => (
                          <tr
                            key={t.id}
                            onClick={t.onClick}
                            className="hover:bg-slate-50 cursor-pointer group"
                          >
                            <td className="py-3 pl-6 pr-3 text-slate-700 group-hover:text-slate-950">
                              {t.label}
                            </td>
                            <td className="py-3">
                              <span
                                className={cn(
                                  "inline-block rounded-md px-2.5 py-0.5 text-xs font-medium",
                                  t.statusClass
                                )}
                              >
                                {t.statusLabel}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2 text-slate-700 truncate">
                                <PersonAvatar name={t.assignee} />
                                <span className="truncate text-[13px]">
                                  {t.assignee.split("(")[0].trim()}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}

                        {/* Các dòng Con: Việc nhắc riêng do AM tự thêm */}
                        {projectManualTasks.map((mt) => (
                          <tr
                            key={mt.id}
                            className="hover:bg-slate-50 group"
                          >
                            <td className="py-3 pl-6 pr-3">
                              <div className="flex items-start gap-2.5">
                                <input
                                  type="checkbox"
                                  checked={mt.done}
                                  onChange={() => toggleManualTaskDone(mt.id)}
                                  className="mt-1 size-4 rounded border-slate-300 accent-slate-900 cursor-pointer"
                                />
                                <span
                                  onClick={() => toggleManualTaskDone(mt.id)}
                                  className={cn(
                                    "cursor-pointer",
                                    mt.done
                                      ? "line-through text-slate-400"
                                      : "text-slate-800"
                                  )}
                                >
                                  {mt.label}
                                </span>
                              </div>
                            </td>
                            <td className="py-3">
                              <span
                                className={cn(
                                  "inline-block rounded-md px-2.5 py-0.5 text-xs font-medium",
                                  mt.done
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-700"
                                )}
                              >
                                {mt.done ? "Đã xong" : "Tự nhắc"}
                              </span>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center justify-between gap-2 text-slate-700">
                                <div className="flex items-center gap-2 truncate">
                                  <PersonAvatar name={mt.assignee} />
                                  <span className="truncate text-[13px]">
                                    {mt.assignee.split("(")[0].trim()}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeManualTask(mt.id)}
                                  className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-red-600 px-1"
                                  title="Xóa việc nhắc này"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* KHỐI 2 (4 CỘT): SỔ THEO DÕI HỖ TRỢ 0Đ & PHỤ LỤC PHÁT SINH THEO TỪNG DỰ ÁN */}
          <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 flex flex-col">
            <div className="flex items-start justify-between gap-2 shrink-0 mb-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Sổ Hỗ trợ 0đ & Phụ lục phát sinh
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sao chép bằng chứng hỗ trợ 0đ riêng theo từng khách hàng để đòi tiền / ký phụ lục
                </p>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 shrink-0">
                {grandTotals.totalFreeSupportCount} lần 0đ ({grandTotals.totalFreeSupportRealMd} ngày)
              </span>
            </div>

            <div className="relative flex-1 min-h-[280px]">
              <div className="lg:absolute lg:inset-0 overflow-y-auto divide-y divide-slate-200 pr-1">
                {contracts
                  .filter((c) => c.changeRequests.length > 0)
                  .map((contract) => {
                    const freeCount = contract.changeRequests.filter(
                      (cr) =>
                        cr.crType === "FREE_SUPPORT" ||
                        cr.status === "APPROVED_FREE_GOODWILL"
                    ).length

                    return (
                      <div
                        key={contract.id}
                        className="py-3.5 first:pt-1 last:pb-1 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openContractDetail(contract.id)}
                            className="text-left group"
                          >
                            <div className="text-xs font-mono text-slate-500">
                              {contract.contractCode.split("/")[0]} •{" "}
                              {contract.customerName}
                            </div>
                            <div className="text-sm font-semibold text-slate-900 group-hover:underline">
                              {contract.projectName}
                            </div>
                          </button>

                          {freeCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyProjectGoodwillEvidence(contract)
                              }
                              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 shrink-0 transition-colors"
                              title="Sao chép văn bản bằng chứng hỗ trợ 0đ của riêng khách hàng này"
                            >
                              <IconCopy className="size-3.5 text-slate-600" />
                              <span>Sao chép 0đ ({freeCount})</span>
                            </button>
                          )}
                        </div>

                        <div className="divide-y divide-slate-200/70 border-t border-slate-200/70 pt-1">
                          {contract.changeRequests.map((cr) => {
                            const isFree =
                              cr.crType === "FREE_SUPPORT" ||
                              cr.status === "APPROVED_FREE_GOODWILL"

                            return (
                              <div
                                key={cr.id}
                                className="py-2 flex items-start justify-between gap-2 text-xs"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="font-medium text-slate-800">
                                    {cr.title}
                                  </div>
                                  <div className="text-slate-500">
                                    {isFree
                                      ? `${cr.devMandays ?? cr.pmEstimatedMandays} MD hỗ trợ 0đ (1:1 • Cột riêng)`
                                      : `+${cr.pmEstimatedMandays} ngày • ${roleView === "PM" ? "Đã ẩn giá" : formatMoney(cr.quotedPriceVnd)}`}
                                  </div>
                                </div>

                                <span
                                  className={cn(
                                    "rounded px-2 py-0.5 text-[11px] font-medium shrink-0",
                                    isFree
                                      ? "bg-slate-200/80 text-slate-800"
                                      : cr.status === "APPROVED_UPSELL"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                                        : "bg-amber-50 text-amber-800 border border-amber-200/70"
                                  )}
                                >
                                  {isFree
                                    ? "Hỗ trợ 0đ"
                                    : cr.status === "APPROVED_UPSELL"
                                      ? "Đã ký PL"
                                      : "Chờ duyệt PL"}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================================
            HÀNG DƯỚI: CÁC DỰ ÁN & MỐC BÀN GIAO ĐANG TRIỂN KHAI (TẬP TRUNG THEO DÕI HÀNG NGÀY)
           ===================================================================== */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Các Dự án & Mốc bàn giao đang triển khai
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Tập trung vào các dự án đang chạy và các mốc chưa hoàn thành để AM theo dõi sát tiến độ hàng ngày
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setOnlyRunningInHome(true)
                    setOnlyRiskContracts(false)
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium transition-colors",
                    onlyRunningInHome && !onlyRiskContracts
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Đang chạy thực tế (
                  {contracts.filter((c) => c.phase === "IN_PROJECT").length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOnlyRiskContracts(true)
                    setOnlyRunningInHome(false)
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium transition-colors",
                    onlyRiskContracts
                      ? "bg-red-600 text-white shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Vượt Target / Nguy cơ ({grandTotals.bleedingContractCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOnlyRunningInHome(false)
                    setOnlyRiskContracts(false)
                  }}
                  className={cn(
                    "rounded-md px-3 py-1.5 font-medium transition-colors",
                    !onlyRunningInHome && !onlyRiskContracts
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  Tất cả ({contracts.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveScreen("contracts")}
                className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
              >
                Mở toàn bộ danh mục Dự án →
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[13px] text-slate-500 border-b border-slate-200">
                  <th className="py-3 pl-2 font-medium w-[34%]">
                    Trạng thái / Dự án & Mốc bàn giao đang chạy
                  </th>
                  <th className="py-3 font-medium w-[18%]">
                    Khách hàng / Phụ trách
                  </th>
                  <th className="py-3 font-medium text-right w-[14%]">
                    Giá trị
                  </th>
                  <th className="py-3 font-medium text-right w-[22%]">
                    Tiến độ Ngày công (Thực tiêu / Trần)
                  </th>
                  <th className="py-3 pr-2 font-medium text-right w-[12%]">
                    Số dư Quỹ
                  </th>
                </tr>
              </thead>

              <tbody className="text-sm divide-y divide-slate-100">
                {(onlyRiskContracts
                  ? contracts.filter((c) => {
                      const m = calculateContractMetrics(c)
                      return (
                        m.isOverLimit ||
                        m.effectiveRealMandays > m.effectiveTargetMandays
                      )
                    })
                  : onlyRunningInHome
                    ? contracts.filter((c) => c.phase === "IN_PROJECT")
                    : contracts
                ).map((contract) => {
                  const m = calculateContractMetrics(contract)
                  const isExpanded = Boolean(expandedContracts[contract.id])
                  const visibleMilestones = onlyRunningInHome
                    ? contract.scopeItems.filter((ms) => {
                        const fm = getMilestoneFourMetrics(ms, contract)
                        return !fm.isFinished || fm.isOverLimit
                      })
                    : contract.scopeItems
                  const hiddenFinishedCount =
                    contract.scopeItems.length - visibleMilestones.length

                  return (
                    <React.Fragment key={contract.id}>
                      {/* DÒNG CHA: HỢP ĐỒNG / DỰ ÁN */}
                      <tr className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-3.5 pl-2">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => toggleExpand(contract.id)}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500"
                              title="Bung/thu gọn các Mốc bàn giao"
                            >
                              {isExpanded ? (
                                <IconChevronDown className="size-4" />
                              ) : (
                                <IconChevronRight className="size-4" />
                              )}
                            </button>

                            <span
                              className={cn(
                                "rounded-md px-2.5 py-0.5 text-xs font-medium",
                                m.isOverLimit
                                  ? "bg-red-50 text-red-700 border border-red-200/70"
                                  : contract.phase === "CLOSED"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                                    : "bg-slate-100 text-slate-700"
                              )}
                            >
                              {m.isOverLimit
                                ? "Vượt trần"
                                : contract.phase === "CLOSED"
                                  ? "Hoàn thành"
                                  : "Đang chạy"}
                            </span>

                            <button
                              type="button"
                              onClick={() => openContractDetail(contract.id)}
                              className="font-semibold text-slate-900 hover:underline text-left"
                            >
                              {contract.projectName}
                            </button>

                            {onlyRunningInHome && hiddenFinishedCount > 0 && (
                              <span className="text-xs text-slate-500">
                                ({hiddenFinishedCount} mốc đã xong)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 text-slate-600">
                          <div className="flex items-center gap-2">
                            <IconFolder className="size-4 text-slate-400 shrink-0" />
                            <span>
                              {contract.customerName}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 text-right tabular-nums text-slate-700">
                          {roleView === "PM"
                            ? "Đã ẩn"
                            : formatMoney(m.totalContractValue)}
                        </td>

                        <td className="py-3.5 text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <div className="flex items-center justify-end gap-2.5 tabular-nums">
                              <span className="font-semibold text-slate-900">
                                {m.effectiveRealMandays}
                                <span className="text-slate-500 font-normal">
                                  {" "}
                                  /{" "}
                                  {roleView === "PM"
                                    ? `${m.effectiveTargetMandays} ngày`
                                    : `${m.totalMaxMandays} ngày`}
                                </span>
                              </span>
                              <MandayBulletBar
                                realMd={m.effectiveRealMandays}
                                targetMd={m.effectiveTargetMandays}
                                limitMd={m.totalMaxMandays}
                              />
                              <span
                                className={cn(
                                  "w-9 text-right text-xs tabular-nums",
                                  m.isOverLimit
                                    ? "text-red-600 font-semibold"
                                    : "text-slate-600"
                                )}
                              >
                                {m.burnVsMaxPercent}%
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 tabular-nums">
                              Giao PM: {m.effectiveTargetMandays}d • Ước tính:{" "}
                              {m.effectiveEstimateMandays}d
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 pr-2 text-right tabular-nums">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold",
                              m.surplusMandays < 0
                                ? "bg-red-50 text-red-700 border border-red-200/80"
                                : "bg-emerald-50/70 text-emerald-800 border border-emerald-200/70"
                            )}
                          >
                            {m.surplusMandays >= 0
                              ? `+${m.surplusMandays} ngày`
                              : `${m.surplusMandays} ngày`}
                          </span>
                        </td>
                      </tr>

                      {/* CÁC DÒNG CON THỤT LỀ: TỪNG MỐC BÀN GIAO ĐANG CHẠY */}
                      {isExpanded &&
                        visibleMilestones.map((ms) => {
                          const fm = getMilestoneFourMetrics(ms, contract)
                          const burnPct =
                            fm.limitMandays > 0
                              ? Math.round(
                                (fm.realMandays / fm.limitMandays) * 100
                              )
                              : 0

                          return (
                            <tr
                              key={ms.id}
                              onClick={() => openContractDetail(contract.id)}
                              className="bg-slate-50/40 hover:bg-slate-100/60 cursor-pointer group/ms"
                            >
                              <td className="py-3 pl-11 pr-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="font-mono text-xs font-semibold text-slate-500">
                                      {ms.code}
                                    </span>
                                    <span className="text-slate-800 truncate group-hover/ms:underline">
                                      {ms.title}
                                    </span>
                                    {fm.isFinished && (
                                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                        <IconCheck className="size-3.5" />
                                        Hoàn thành
                                      </span>
                                    )}
                                  </div>

                                  <span className="opacity-0 group-hover/ms:opacity-100 text-xs font-medium text-slate-500 shrink-0">
                                    Mở dự án →
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 text-slate-600">
                                <div className="flex items-center gap-2">
                                  <PersonAvatar
                                    name={ms.ownerPic || contract.pmOwner}
                                  />
                                  <span className="truncate text-[13px]">
                                    {(ms.ownerPic || contract.pmOwner)
                                      .split("(")[0]
                                      .trim()}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 text-right tabular-nums text-slate-500">
                                {roleView === "PM"
                                  ? "—"
                                  : formatMoney(fm.limitValueVnd)}
                              </td>

                              <td className="py-3 text-right">
                                <div className="inline-flex flex-col items-end gap-0.5">
                                  <div className="flex items-center justify-end gap-2.5 tabular-nums text-slate-700">
                                    <span className="font-medium text-slate-900">
                                      {fm.realMandays}
                                      <span className="text-slate-500 font-normal">
                                        {" "}
                                        /{" "}
                                        {roleView === "PM"
                                          ? `${fm.targetMandays} ngày`
                                          : `${fm.limitMandays} ngày`}
                                      </span>
                                    </span>
                                    <MandayBulletBar
                                      realMd={fm.realMandays}
                                      targetMd={fm.targetMandays}
                                      limitMd={fm.limitMandays}
                                    />
                                    <span className="w-9 text-right text-xs tabular-nums">
                                      {burnPct}%
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-500 tabular-nums">
                                    Giao PM: {fm.targetMandays}d • Ước tính:{" "}
                                    {fm.estimateMandays}d
                                  </span>
                                </div>
                              </td>

                              <td
                                className={cn(
                                  "py-3 pr-2 text-right tabular-nums",
                                  fm.balanceVsLimitMandays < 0
                                    ? "text-red-600 font-semibold"
                                    : "text-slate-700"
                                )}
                              >
                                {fm.balanceVsLimitMandays >= 0
                                  ? `+${fm.balanceVsLimitMandays} ngày`
                                  : `${fm.balanceVsLimitMandays} ngày`}
                              </td>
                            </tr>
                          )
                        })}
                    </React.Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-900">
                  <td className="py-3.5 pl-2" colSpan={2}>
                    TỔNG CỘNG DANH MỤC ({contracts.length} hợp đồng)
                  </td>
                  <td className="py-3.5 text-right tabular-nums">
                    {roleView === "PM"
                      ? "Đã ẩn"
                      : formatMoney(grandTotals.totalRevenue)}
                  </td>
                  <td className="py-3.5 text-right">
                    <div className="inline-flex items-center justify-end gap-2.5 tabular-nums">
                      <span>
                        {grandTotals.totalRealMd} /{" "}
                        {roleView === "PM"
                          ? `${grandTotals.totalTargetMd} ngày`
                          : `${grandTotals.totalLimitMd} ngày`}
                      </span>
                      <MandayBulletBar
                        realMd={grandTotals.totalRealMd}
                        targetMd={grandTotals.totalTargetMd}
                        limitMd={grandTotals.totalLimitMd}
                      />
                      <span className="w-9 text-right text-xs">
                        {grandTotals.burnPct}%
                      </span>
                    </div>
                  </td>
                  <td
                    className={cn(
                      "py-3.5 pr-2 text-right tabular-nums",
                      grandTotals.remainingMd < 0
                        ? "text-red-600"
                        : "text-emerald-700"
                    )}
                  >
                    {grandTotals.remainingMd >= 0
                      ? `+${grandTotals.remainingMd} ngày`
                      : `${grandTotals.remainingMd} ngày`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
