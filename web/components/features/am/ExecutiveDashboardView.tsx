"use client"

import * as React from "react"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconPlus,
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import {
  calculateContractMetrics,
  formatCompactVnd,
  formatVnd,
} from "@/lib/mock/am-types"

export function ExecutiveDashboardView() {
  const {
    contracts,
    customers,
    roleView,
    setActiveScreen,
    openContractDetail,
  } = useAmPrototype()

  const stats = React.useMemo(() => {
    let activeCount = 0
    let greenCount = 0
    let yellowCount = 0
    let redCount = 0
    let actionableDebtAmount = 0
    let actionableDebtContractCount = 0
    let postProjectReadyCount = 0
    let totalPortfolioValue = 0
    let totalProjectedKpiBonus = 0

    const alertContracts: Array<{
      contract: (typeof contracts)[number]
      metrics: ReturnType<typeof calculateContractMetrics>
    }> = []

    const urgentInstallments: Array<{
      contractId: string
      contractCode: string
      projectName: string
      customerName: string
      installmentName: string
      amount: number
      dueDate: string
      status: string
    }> = []

    const pendingCrs: Array<{
      contractId: string
      contractCode: string
      projectName: string
      crCode: string
      crTitle: string
      estimatedMd: number
      quotedPrice: number
    }> = []

    contracts.forEach((c) => {
      const m = calculateContractMetrics(c)
      totalPortfolioValue += m.totalContractValue
      if (c.phase !== "CLOSED") activeCount++

      if (m.healthStatus === "GREEN") greenCount++
      if (m.healthStatus === "YELLOW") yellowCount++
      if (m.healthStatus === "RED") redCount++

      if (m.healthStatus === "RED" || m.healthStatus === "YELLOW") {
        alertContracts.push({ contract: c, metrics: m })
      }

      if (m.actionableDebtAmount > 0) {
        actionableDebtAmount += m.actionableDebtAmount
        actionableDebtContractCount++
      }

      c.installments.forEach((inst) => {
        if (
          inst.paymentStatus === "OVERDUE" ||
          inst.paymentStatus === "INVOICED"
        ) {
          urgentInstallments.push({
            contractId: c.id,
            contractCode: c.contractCode,
            projectName: c.projectName,
            customerName: c.customerName,
            installmentName: inst.name,
            amount: inst.amount,
            dueDate: inst.dueDate,
            status: inst.paymentStatus,
          })
        }
      })

      c.changeRequests.forEach((cr) => {
        if (cr.status === "AM_QUOTING" || cr.status === "PM_ESTIMATING") {
          pendingCrs.push({
            contractId: c.id,
            contractCode: c.contractCode,
            projectName: c.projectName,
            crCode: cr.code,
            crTitle: cr.title,
            estimatedMd: cr.pmEstimatedMandays,
            quotedPrice: cr.quotedPriceVnd,
          })
        }
      })

      if (c.phase === "POST_PROJECT") postProjectReadyCount++
      if (m.isProfitable) totalProjectedKpiBonus += m.kpiBonusAmountVnd
    })

    return {
      activeCount,
      greenCount,
      yellowCount,
      redCount,
      actionableDebtAmount,
      actionableDebtContractCount,
      postProjectReadyCount,
      totalPortfolioValue,
      totalProjectedKpiBonus,
      alertContracts,
      urgentInstallments,
      pendingCrs,
    }
  }, [contracts])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Bảng Điều Khiển Tổng Quan (Portfolio Health Check)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tóm tắt các chỉ số quan trọng toàn công ty và các đầu việc khẩn cấp cần AM Thảo / BOD xử lý ngay trong ngày
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setActiveScreen("contracts")}
            className="h-9 text-xs gap-1.5"
          >
            <span>Xem Danh sách Hợp đồng ({contracts.length})</span>
            <IconArrowRight className="size-3.5" />
          </Button>
          <Button
            onClick={() => setActiveScreen("create-contract")}
            className="gap-1.5 bg-primary hover:bg-primary/90 text-white h-9 text-xs"
          >
            <IconPlus className="size-4" />
            Tạo Hợp đồng mới
          </Button>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          onClick={() => setActiveScreen("contracts")}
          className="shadow-none border bg-card cursor-pointer hover:border-primary/40 transition-colors"
        >
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground">
              Dự án đang chạy
            </div>
            <div className="text-3xl font-bold text-foreground mt-2">
              {stats.activeCount}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              {roleView === "PM"
                ? `${customers.length} khách hàng doanh nghiệp`
                : `Tổng quy mô: ${formatCompactVnd(stats.totalPortfolioValue)}`}
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveScreen("contracts")}
          className="shadow-none border bg-card cursor-pointer hover:border-primary/40 transition-colors"
        >
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground">
              Sức khỏe dự án (Xanh / Vàng / Đỏ)
            </div>
            <div className="flex items-center gap-2.5 mt-2.5">
              <span className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50/60 border-emerald-200">
                <span className="size-2 rounded-full bg-emerald-500" />
                {stats.greenCount} Xanh
              </span>
              <span className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50/60 border-amber-200">
                <span className="size-2 rounded-full bg-amber-500" />
                {stats.yellowCount} Vàng
              </span>
              <span className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50/60 border-red-200">
                <span className="size-2 rounded-full bg-red-600" />
                {stats.redCount} Đỏ
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-2.5">
              Click để mở Danh sách Hợp đồng & lọc chi tiết
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveScreen("billing-vat")}
          className="shadow-none border bg-card cursor-pointer hover:border-primary/40 transition-colors"
        >
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground">
              Công nợ đã đến hạn / quá hạn chờ thu
            </div>
            <div className="text-2xl font-bold text-red-600 mt-2">
              {roleView === "PM"
                ? `${stats.actionableDebtContractCount} HĐ cần thu`
                : formatVnd(stats.actionableDebtAmount)}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Click để mở danh sách Thanh toán & Hóa đơn VAT →
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveScreen("contracts")}
          className="shadow-none border bg-card cursor-pointer hover:border-primary/40 transition-colors"
        >
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground">
              Chờ nghiệm thu (Post-Project)
            </div>
            <div className="text-3xl font-bold text-foreground mt-2">
              {stats.postProjectReadyCount}
            </div>
            <div className="text-xs text-emerald-700 font-medium mt-2">
              {roleView === "PM"
                ? "Hoàn tất 100% Scope để đóng HĐ"
                : `Quỹ thưởng KPI dự kiến: ${formatCompactVnd(stats.totalProjectedKpiBonus)}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2 Cột Trung tâm Hành động Nhanh (Action Center) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (7 phần): Dự án đang báo Đỏ / Vàng cần can thiệp */}
        <div className="lg:col-span-7">
          <Card className="shadow-none border bg-card h-full">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <IconAlertTriangle className="size-4 text-red-600" />
                <CardTitle className="text-sm font-semibold">
                  1. Các Dự Án Đang Cảnh Báo Đỏ & Vàng ({stats.alertContracts.length})
                </CardTitle>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-primary gap-1"
                onClick={() => setActiveScreen("contracts")}
              >
                <span>Tất cả hợp đồng</span>
                <IconArrowRight className="size-3.5" />
              </Button>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              {stats.alertContracts.map(({ contract, metrics }) => {
                const isRed = metrics.healthStatus === "RED"
                return (
                  <div
                    key={contract.id}
                    onClick={() => openContractDetail(contract.id)}
                    className="rounded-lg border p-4 hover:bg-slate-50 cursor-pointer space-y-2.5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            {contract.contractCode}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              isRed
                                ? "bg-red-50 text-red-600 border-red-200 text-[11px]"
                                : "bg-amber-50 text-amber-700 border-amber-200 text-[11px]"
                            }
                          >
                            {isRed ? "Báo động Đỏ" : "Cảnh báo Vàng"}
                          </Badge>
                        </div>
                        <div className="font-medium text-sm text-foreground mt-1">
                          {contract.projectName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Khách hàng: {contract.customerName} • PM: {contract.pmOwner}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs shrink-0 gap-1"
                      >
                        <span>Xử lý</span>
                        <IconArrowRight className="size-3.5" />
                      </Button>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          Tiêu hao Credit: {contract.actualConsumedMandays} /{" "}
                          {contract.amTargetMandays} MD
                        </span>
                        <span className="font-semibold">
                          {metrics.burnVsTargetPercent}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, metrics.burnVsTargetPercent)}
                        indicatorClassName={isRed ? "bg-red-600" : "bg-amber-500"}
                        className="h-1.5"
                      />
                    </div>

                    <p
                      className={
                        isRed
                          ? "text-xs text-red-600 font-medium pt-1 border-t"
                          : "text-xs text-amber-700 font-medium pt-1 border-t"
                      }
                    >
                      Điểm nghẽn: {metrics.synthesizedActionBlocker}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* Cột phải (5 phần): Công nợ đến hạn & Phát sinh CR chờ báo giá */}
        <div className="lg:col-span-5 space-y-6">
          {/* Việc cần thu tiền */}
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                2. Đợt Thanh Toán Đến Hạn / Quá Hạn ({stats.urgentInstallments.length})
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-primary gap-1"
                onClick={() => setActiveScreen("billing-vat")}
              >
                <span>Mở bảng Thu tiền & VAT</span>
                <IconArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {stats.urgentInstallments.map((u, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveScreen("billing-vat")}
                  className="rounded-md border p-3 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {u.installmentName}
                    </div>
                    <div className="text-muted-foreground truncate mt-0.5">
                      {u.contractCode} • {u.customerName} (Hạn: {u.dueDate})
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {roleView !== "PM" && (
                      <div className="font-bold text-red-600">
                        {formatVnd(u.amount)}
                      </div>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        u.status === "OVERDUE"
                          ? "bg-red-50 text-red-600 border-red-200 text-[10px]"
                          : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                      }
                    >
                      {u.status === "OVERDUE" ? "Quá hạn" : "Chờ thu"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* CR chờ báo giá / duyệt */}
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                3. Phát Sinh (CR) Chờ Báo Giá / Duyệt ({stats.pendingCrs.length})
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-primary gap-1"
                onClick={() => setActiveScreen("change-requests")}
              >
                <span>Mở danh sách CR</span>
                <IconArrowRight className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {stats.pendingCrs.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveScreen("change-requests")}
                  className="rounded-md border p-3 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      [{item.crCode}] {item.crTitle}
                    </div>
                    <div className="text-muted-foreground truncate mt-0.5">
                      {item.contractCode} • {item.projectName}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="secondary" className="text-[11px] font-mono">
                      +{item.estimatedMd} MD
                    </Badge>
                    {roleView !== "PM" && (
                      <div className="text-[11px] font-semibold text-foreground mt-0.5">
                        {formatVnd(item.quotedPrice)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
