"use client"

import * as React from "react"
import {
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider"
import {
  useWorkspaceContracts,
  useWorkspaceCustomerOptions,
  useWorkspaceRole,
} from "@/lib/hooks/use-workspace-data"
import {
  MandayBulletBar,
  PersonAvatar,
} from "@/components/features/am/ProductiveHomeDashboard"
import {
  calculateContractMetrics,
  ProjectPhase,
} from "@/lib/mock/am-types"
import { cn } from "@/lib/utils"

const PHASE_BADGE_MAP: Record<
  ProjectPhase,
  { label: string; className: string }
> = {
  PRE_PROJECT: {
    label: "Chuẩn bị",
    className: "bg-slate-100 text-slate-700",
  },
  IN_PROJECT: {
    label: "Đang chạy",
    className: "bg-slate-100 text-slate-800",
  },
  POST_PROJECT: {
    label: "Bàn giao",
    className: "bg-slate-100 text-slate-800",
  },
  CLOSED: {
    label: "Hoàn thành",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200/70",
  },
}

export function PortfolioDashboardView() {
  const { contracts, isLoading: isContractsLoading } = useWorkspaceContracts({
    includeDetails: false,
  })
  const { customerOptions: customers } = useWorkspaceCustomerOptions()
  const { isPmRole } = useWorkspaceRole()

  const {
    formatMoney,
    setActiveScreen,
    openContractDetail,
  } = useWorkspaceUi()
  const roleView = isPmRole ? "PM" : "AM"

  const [searchQuery, setSearchQuery] = React.useState("")
  const [healthFilter, setHealthFilter] = React.useState<string>("ALL")
  const [phaseFilter, setPhaseFilter] = React.useState<string>("ALL")
  const [customerFilter, setCustomerFilter] = React.useState<string>("ALL")

  const filteredContracts = React.useMemo(() => {
    return contracts.filter((c) => {
      const m = calculateContractMetrics(c)
      if (healthFilter !== "ALL" && m.healthStatus !== healthFilter) return false
      if (phaseFilter !== "ALL" && c.phase !== phaseFilter) return false
      if (customerFilter !== "ALL" && c.customerId !== customerFilter)
        return false
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase()
        return (
          c.projectName.toLowerCase().includes(q) ||
          c.contractCode.toLowerCase().includes(q) ||
          c.customerName.toLowerCase().includes(q) ||
          c.pmOwner.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [contracts, healthFilter, phaseFilter, customerFilter, searchQuery])

  const summary = React.useMemo(() => {
    let greenCount = 0
    let yellowCount = 0
    let redCount = 0
    let totalLimitMd = 0
    let totalTargetMd = 0
    let totalEstimateMd = 0
    let totalRealMd = 0
    let totalContractValueVnd = 0

    filteredContracts.forEach((c) => {
      const m = calculateContractMetrics(c)
      if (m.healthStatus === "GREEN") greenCount++
      if (m.healthStatus === "YELLOW") yellowCount++
      if (m.healthStatus === "RED") redCount++

      totalLimitMd += m.totalMaxMandays
      totalTargetMd += m.effectiveTargetMandays
      totalEstimateMd += m.effectiveEstimateMandays
      totalRealMd += m.effectiveRealMandays
      totalContractValueVnd += m.totalContractValue
    })

    const totalRemainingMd = totalLimitMd - totalRealMd
    const avgBurnPct =
      totalLimitMd > 0 ? Math.round((totalRealMd / totalLimitMd) * 100) : 0

    return {
      greenCount,
      yellowCount,
      redCount,
      totalLimitMd,
      totalTargetMd,
      totalEstimateMd,
      totalRealMd,
      totalRemainingMd,
      avgBurnPct,
      totalContractValueVnd,
    }
  }, [filteredContracts])

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Danh sách Dự án
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Bấm vào bất kỳ dự án nào để mở Bảng Cân Đối 4 Chỉ Số Theo Từng Mốc Bàn Giao (M1, M2, M3...)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setHealthFilter(healthFilter === "ALL" ? "ALL" : "ALL")
              }
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                healthFilter === "ALL"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              Tất cả ({contracts.length})
            </button>
            <button
              type="button"
              onClick={() =>
                setHealthFilter(healthFilter === "RED" ? "ALL" : "RED")
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                healthFilter === "RED"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              <span className="size-2 rounded-full bg-red-500" />
              Vượt trần ngân sách ({summary.redCount})
            </button>
          </div>

          <Button
            onClick={() => setActiveScreen("create-contract")}
            className="gap-1.5 bg-slate-900 hover:bg-slate-800 text-white h-9 px-4 text-sm font-medium rounded-lg"
          >
            <IconPlus className="size-4" />
            Khởi tạo Dự án
          </Button>
        </div>
      </div>

      {/* Main Productive.io Flat Table Card */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Filter Strip */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="relative w-full sm:w-80">
            <IconSearch className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã HĐ, tên dự án, khách hàng, PM..."
              className="pl-9 h-9 text-sm border-slate-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="w-60 h-9 text-sm border-slate-200">
                <SelectValue placeholder="Tất cả Khách hàng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">
                  Tất cả Khách hàng ({customers.length})
                </SelectItem>
                {customers.map((cust) => (
                  <SelectItem key={cust.id} value={cust.id}>
                    {cust.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={phaseFilter} onValueChange={setPhaseFilter}>
              <SelectTrigger className="w-44 h-9 text-sm border-slate-200">
                <SelectValue placeholder="Giai đoạn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Mọi giai đoạn</SelectItem>
                <SelectItem value="PRE_PROJECT">Chuẩn bị khởi động</SelectItem>
                <SelectItem value="IN_PROJECT">Đang triển khai</SelectItem>
                <SelectItem value="POST_PROJECT">Bàn giao & Nghiệm thu</SelectItem>
                <SelectItem value="CLOSED">Đã hoàn thành</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery ||
              healthFilter !== "ALL" ||
              phaseFilter !== "ALL" ||
              customerFilter !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("")
                  setHealthFilter("ALL")
                  setPhaseFilter("ALL")
                  setCustomerFilter("ALL")
                }}
                className="h-9 text-sm text-slate-500"
              >
                Xóa lọc
              </Button>
            )}
          </div>
        </div>

        {/* Clean 14px Monochrome Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 font-medium">Trạng thái</th>
                <th className="py-3 px-3 font-medium">Mã HĐ</th>
                <th className="py-3 px-3 font-medium">Tên Dự án</th>
                <th className="py-3 px-3 font-medium">Khách hàng</th>
                <th className="py-3 px-3 font-medium">PM tổng</th>
                <th className="py-3 px-3 text-center font-medium">Mốc xong</th>
                {roleView !== "PM" && (
                  <th className="py-3 px-3 text-right font-medium">
                    Giá trị HĐ
                  </th>
                )}
                <th className="py-3 px-3 text-right font-medium">
                  Tiến độ Ngày công (Thực tiêu / Trần)
                </th>
                <th className="py-3 pl-3 pr-5 text-right font-medium">
                  Số dư Quỹ
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredContracts.map((contract) => {
                const m = calculateContractMetrics(contract)
                const phaseInfo = PHASE_BADGE_MAP[contract.phase]
                const remainingMd =
                  roleView === "PM"
                    ? m.effectiveTargetMandays - m.effectiveRealMandays
                    : m.surplusMandays
                const burnPct =
                  roleView === "PM"
                    ? m.burnVsTargetPercent
                    : m.burnVsMaxPercent
                const isOver = remainingMd < 0

                return (
                  <tr
                    key={contract.id}
                    onClick={() => openContractDetail(contract.id)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors group whitespace-nowrap"
                  >
                    {/* 1. Phase Pill */}
                    <td className="py-3.5 pl-5 pr-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-medium",
                          isOver
                            ? "bg-red-50 text-red-700 border border-red-200/70"
                            : phaseInfo.className
                        )}
                      >
                        {isOver ? "Vượt trần" : phaseInfo.label}
                      </span>
                    </td>

                    {/* 2. Mã HĐ */}
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-500">
                      {contract.contractCode}
                    </td>

                    {/* 3. Tên Dự án */}
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-slate-900 group-hover:underline">
                        {contract.projectName}
                      </span>
                    </td>

                    {/* 4. Khách hàng */}
                    <td className="py-3.5 px-3 text-slate-600">
                      {contract.customerName}
                    </td>

                    {/* 5. PM Tổng */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <PersonAvatar name={contract.pmOwner} />
                        <span className="text-slate-700">
                          {contract.pmOwner.split("(")[0].trim()}
                        </span>
                      </div>
                    </td>

                    {/* 6. Số Mốc hoàn thành */}
                    <td className="py-3.5 px-3 text-center tabular-nums text-slate-600">
                      {m.acceptedScopeCount}/{m.totalScopeCount}
                    </td>

                    {/* 7. Giá trị HĐ */}
                    {roleView !== "PM" && (
                      <td className="py-3.5 px-3 text-right tabular-nums text-slate-700">
                        {formatMoney(m.totalContractValue)}
                      </td>
                    )}

                    {/* 8. Tiến độ Ngày công (Thực tiêu / Trần) */}
                    <td className="py-3.5 px-3 text-right">
                      <div className="inline-flex flex-col items-end gap-1">
                        <div className="flex items-center justify-end gap-2.5 tabular-nums">
                          <span
                            className={cn(
                              "font-semibold",
                              isOver ? "text-red-600" : "text-slate-900"
                            )}
                          >
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
                              isOver
                                ? "text-red-600 font-semibold"
                                : "text-slate-600"
                            )}
                          >
                            {burnPct}%
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          Giao PM: {m.effectiveTargetMandays}d • Ước tính:{" "}
                          {m.effectiveEstimateMandays}d
                        </span>
                      </div>
                    </td>

                    {/* 9. Số dư Quỹ */}
                    <td className="py-3.5 pl-3 pr-5 text-right tabular-nums">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold",
                          isOver
                            ? "bg-red-50 text-red-700 border border-red-200/80"
                            : "bg-emerald-50/70 text-emerald-800 border border-emerald-200/70"
                        )}
                      >
                        {remainingMd > 0
                          ? `+${remainingMd} ngày`
                          : `${remainingMd} ngày`}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
