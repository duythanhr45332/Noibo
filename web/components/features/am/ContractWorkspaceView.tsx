"use client"

import * as React from "react"
import {
  IconArrowLeft,
  IconArrowUpRight,
  IconBrandGoogleDrive,
  IconCheck,
  IconChecklist,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconRefresh,
  IconTag,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import {
  MandayBulletBar,
  PersonAvatar,
  ProductiveDonutRing,
} from "@/components/features/am/ProductiveHomeDashboard"
import {
  calculateContractMetrics,
  ChangeRequestType,
  evaluateKickoffChecklist,
  FREE_SUPPORT_MAX_MD_PER_MILESTONE,
  getMilestoneFourMetrics,
  getMilestoneFreeSupportUsedMd,
  ScopeItem,
  VatCategory,
} from "@/lib/mock/am-types"
import { cn } from "@/lib/utils"

const QUICK_TAG_SUGGESTIONS = [
  "Khách khó tính",
  "Chờ sếp duyệt",
  "Nguy cơ trễ",
  "Ưu tiên VIP",
  "Khách hay đổi ý",
  "Chờ tạm ứng",
]

const PIC_SUGGESTIONS = [
  "Chị Giang (PM tổng)",
  "Anh Du (Tech Lead - Foundation)",
  "Anh Thanh (Đào tạo & UAT)",
  "Anh Minh (PM)",
]

export function ContractWorkspaceView() {
  const {
    contracts,
    selectedContract,
    setSelectedContractId,
    setActiveScreen,
    roleView,
    formatMoney,
    logMilestoneMandays,
    finishMilestone,
    reopenMilestone,
    addScopeItem,
    updateScopeItem,
    updateInstallment,
    addChangeRequest,
    resolveChangeRequest,
    updateKickoffChecklist,
    toggleDriveVerified,
    approveKickoffByBod,
    updateHandover,
    closeProjectAndSettleKpi,
    addContractTag,
    removeContractTag,
  } = useAmPrototype()

  const contract = selectedContract
  const metrics = React.useMemo(
    () => calculateContractMetrics(contract),
    [contract]
  )
  const kickoffEval = React.useMemo(
    () => evaluateKickoffChecklist(contract),
    [contract]
  )

  // Slide-over Drawers
  const [selectedScopeId, setSelectedScopeId] = React.useState<string | null>(
    null
  )
  const [kickoffDrawerOpen, setKickoffDrawerOpen] = React.useState(false)
  const [handoverDrawerOpen, setHandoverDrawerOpen] = React.useState(false)
  const [tagModalOpen, setTagModalOpen] = React.useState(false)
  const [newTagDraft, setNewTagDraft] = React.useState("")

  // Modal + Thêm Mốc bàn giao mới
  const [addScopeOpen, setAddScopeOpen] = React.useState(false)
  const [newScopeCode, setNewScopeCode] = React.useState("")
  const [newScopeTitle, setNewScopeTitle] = React.useState("")
  const [newScopePic, setNewScopePic] = React.useState(contract.pmOwner)
  const [newScopeLimitMd, setNewScopeLimitMd] = React.useState("20")
  const [newScopeTargetMd, setNewScopeTargetMd] = React.useState("16")
  const [newScopeCodeEstMd, setNewScopeCodeEstMd] = React.useState("14")
  const [newScopeHandoverEstMd, setNewScopeHandoverEstMd] = React.useState("2")
  const [newScopeDueDate, setNewScopeDueDate] = React.useState("2026-12-15")
  const [newScopePrice, setNewScopePrice] = React.useState("60000000")
  const [newScopeVat, setNewScopeVat] = React.useState<VatCategory>("VAT_10")

  // State trong Drawer Chi tiết Mốc bàn giao
  const [logModeOpen, setLogModeOpen] = React.useState(false)
  const [logDeltaMd, setLogDeltaMd] = React.useState("3")
  const [logDate, setLogDate] = React.useState(
    new Date().toISOString().slice(0, 10)
  )
  const [logNote, setLogNote] = React.useState("")

  const [editScopeMode, setEditScopeMode] = React.useState(false)
  const [editPic, setEditPic] = React.useState("")
  const [editDueDate, setEditDueDate] = React.useState("")
  const [editLimitMd, setEditLimitMd] = React.useState("")
  const [editTargetMd, setEditTargetMd] = React.useState("")
  const [editCodeEstMd, setEditCodeEstMd] = React.useState("")
  const [editHandoverEstMd, setEditHandoverEstMd] = React.useState("")

  // State Ghi nhận Phát sinh (Upsell / Hỗ trợ 0đ <= 1 MD) ngay trong Drawer
  const [addCrMode, setAddCrMode] = React.useState(false)
  const [crType, setCrType] = React.useState<ChangeRequestType>("FREE_SUPPORT")
  const [crTitle, setCrTitle] = React.useState("")
  const [crDevMd, setCrDevMd] = React.useState("0.5")
  const [crTargetMd, setCrTargetMd] = React.useState("1")
  const [crQuoteVnd, setCrQuoteVnd] = React.useState("15000000")

  // State Mở lại Mốc (Reopen Milestone)
  const [reopenModeOpen, setReopenModeOpen] = React.useState(false)
  const [reopenReason, setReopenReason] = React.useState("")

  const activeScope = React.useMemo(
    () => contract.scopeItems.find((s) => s.id === selectedScopeId) || null,
    [contract.scopeItems, selectedScopeId]
  )

  const totalHandoverEstMd = React.useMemo(
    () =>
      contract.scopeItems.reduce(
        (sum, s) => sum + Number(s.handoverEstimatedMandays || 2),
        0
      ),
    [contract.scopeItems]
  )
  const totalCodeEstMd = Math.max(
    0,
    metrics.effectiveEstimateMandays - totalHandoverEstMd
  )

  const handleOpenScopeDrawer = (item: ScopeItem) => {
    const four = getMilestoneFourMetrics(item, contract)
    const handoverMd = Number(item.handoverEstimatedMandays ?? 2)
    const codeMd = Math.max(0, four.estimateMandays - handoverMd)
    setSelectedScopeId(item.id)
    setLogModeOpen(false)
    setEditScopeMode(false)
    setAddCrMode(false)
    setReopenModeOpen(false)
    setReopenReason("")
    setEditPic(item.ownerPic || contract.pmOwner)
    setEditDueDate(item.dueDate || "2026-11-30")
    setEditLimitMd(String(four.limitMandays))
    setEditTargetMd(String(four.targetMandays))
    setEditCodeEstMd(String(codeMd))
    setEditHandoverEstMd(String(handoverMd))
  }

  const handleSubmitPeriodicLog = () => {
    if (!activeScope) return
    const delta = Number(logDeltaMd)
    if (isNaN(delta) || delta <= 0) {
      toast.error("Vui lòng nhập số Manday tiêu hao > 0")
      return
    }
    logMilestoneMandays(contract.id, activeScope.id, {
      deltaMandays: delta,
      checkDate: logDate,
      note:
        logNote.trim() ||
        `Check-in định kỳ ${activeScope.code || "Mốc"}: +${delta} MD`,
      logType: "PERIODIC_CHECK",
    })
    setLogNote("")
    setLogModeOpen(false)
  }

  const handleSaveScopeConfig = () => {
    if (!activeScope) return
    const limitVal = Math.max(1, Number(editLimitMd) || 1)
    const targetVal = Math.max(1, Number(editTargetMd) || 1)
    const codeVal = Math.max(0, Number(editCodeEstMd) || 0)
    const handoverVal = Math.max(0, Number(editHandoverEstMd) || 0)

    updateScopeItem(contract.id, activeScope.id, {
      ownerPic: editPic.trim() || contract.pmOwner,
      dueDate: editDueDate,
      limitMandays: limitVal,
      targetMandays: targetVal,
      estimatedMandays: codeVal + handoverVal,
      handoverEstimatedMandays: handoverVal,
    })
    setEditScopeMode(false)
    toast.success("Đã cập nhật cấu hình 4 chỉ số của Mốc bàn giao!")
  }

  const handleCreateScopeItem = () => {
    if (!newScopeTitle.trim()) {
      toast.error("Vui lòng nhập Tên mốc bàn giao")
      return
    }
    const nextIdx = contract.scopeItems.length + 1
    const code = newScopeCode.trim() || `M${nextIdx}`
    const limitVal = Math.max(1, Number(newScopeLimitMd) || 15)
    const targetVal = Math.max(1, Number(newScopeTargetMd) || 12)
    const codeEstVal = Math.max(0, Number(newScopeCodeEstMd) || 10)
    const handoverEstVal = Math.max(0, Number(newScopeHandoverEstMd) || 2)
    const priceVal = Math.max(0, Number(newScopePrice) || 0)

    addScopeItem(contract.id, {
      code,
      title: newScopeTitle.trim(),
      moduleName: newScopeTitle.trim(),
      description: `Bàn giao nghiệm thu ${newScopeTitle.trim()}`,
      ownerPic: newScopePic.trim() || contract.pmOwner,
      source: "BASELINE",
      dueDate: newScopeDueDate,
      amountBeforeVat: priceVal,
      vatCategory: newScopeVat,
      limitMandays: limitVal,
      targetMandays: targetVal,
      estimatedMandays: codeEstVal + handoverEstVal,
      handoverEstimatedMandays: handoverEstVal,
      actualMandays: 0,
      progressPercent: 0,
      status: "NOT_STARTED",
      isAccepted: false,
      progressLogs: [],
    })
    setAddScopeOpen(false)
    setNewScopeCode("")
    setNewScopeTitle("")
  }

  const handleSubmitScopeCr = () => {
    if (!activeScope) return
    if (!crTitle.trim()) {
      toast.error("Vui lòng nhập nội dung yêu cầu phát sinh")
      return
    }
    const devMd = Number(crDevMd) || 0
    if (devMd <= 0) {
      toast.error("Vui lòng nhập khối lượng ngày công > 0")
      return
    }
    if (crType === "FREE_SUPPORT") {
      const usedFreeOnScope = getMilestoneFreeSupportUsedMd(
        contract,
        activeScope.id
      )
      if (
        usedFreeOnScope + devMd >
        FREE_SUPPORT_MAX_MD_PER_MILESTONE + 1e-6
      ) {
        toast.error(
          `Mốc ${activeScope.code} đã dùng ${usedFreeOnScope}/${FREE_SUPPORT_MAX_MD_PER_MILESTONE} ngày Hỗ trợ 0đ! Phần vượt quá 1 MD Dev/mốc bắt buộc chuyển sang Phụ lục thu phí (Upsell).`
        )
        return
      }
    }

    addChangeRequest(contract.id, {
      milestoneId: activeScope.id,
      milestoneTitle: activeScope.title,
      crType,
      title: crTitle.trim(),
      description: `Phát sinh tại mốc ${activeScope.code}: ${crTitle.trim()}`,
      requestedDate: new Date().toISOString().slice(0, 10),
      requestedByClientContact: contract.customerName,
      devMandays: devMd,
      pmEstimatedMandays: devMd,
      amAllocatedToPmMandays:
        crType === "UPSELL" ? Math.max(1, Number(crTargetMd) || devMd) : devMd,
      quotedPriceVnd:
        crType === "UPSELL" ? Math.max(0, Number(crQuoteVnd) || 0) : 0,
      vatCategory: "VAT_10",
      timelineImpactDays: crType === "UPSELL" ? 5 : 0,
      status:
        crType === "FREE_SUPPORT" ? "APPROVED_FREE_GOODWILL" : "AM_QUOTING",
      amNegotiationNote:
        crType === "FREE_SUPPORT"
          ? "Hỗ trợ thiện chí 0đ (1:1 • lũy kế ≤ 1 MD Dev/mốc, tách cột riêng)"
          : "Báo giá Upsell bổ sung ngân sách & Limit cho Mốc",
    })
    setCrTitle("")
    setAddCrMode(false)
  }

  // Đếm tiến độ Checklist Kick-off & Handover để hiện trên nút Header
  const kickoffReadyCount = kickoffEval.completedCount

  const handoverReadyCount = [
    contract.handover.sourceCodeDelivered,
    contract.handover.userGuideAndVideoDelivered,
    contract.handover.signedAcceptanceScanUploaded,
  ].filter(Boolean).length

  const paidInstallmentCount = contract.installments.filter(
    (i) => i.paymentStatus === "PAID"
  ).length

  return (
    <div className="flex flex-col min-h-full bg-slate-50">
      {/* 1. CLEAN 1-LINE PROJECT HEADER (Productive.io Pure) */}
      <div className="bg-white border-b border-slate-200 px-6 lg:px-8 py-3.5">
        <div className="w-full flex flex-wrap items-center justify-between gap-4">
          {/* Left: Back + Project Switcher + Code + Client */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveScreen("contracts")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
            >
              <IconArrowLeft className="size-4" />
              Danh sách Dự án
            </button>

            <Select
              value={contract.id}
              onValueChange={(val) => setSelectedContractId(val)}
            >
              <SelectTrigger className="h-9 w-[300px] text-sm font-semibold text-slate-900 border-slate-200 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-sm">
                    {c.contractCode} — {c.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-medium text-slate-700">
              {contract.contractCode}
            </span>

            <span className="text-sm text-slate-500 hidden lg:inline">
              {contract.customerName}
            </span>

            <button
              type="button"
              onClick={() => setTagModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <IconTag className="size-3.5" />
              Nhãn ({(contract.amCustomTags || []).length})
            </button>
          </div>

          {/* Right: Drawer Triggers & Primary Action */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Button 1: Checklist Kick-off Drawer */}
            <button
              type="button"
              onClick={() => setKickoffDrawerOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                kickoffReadyCount === 4
                  ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  : "border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-100/70"
              )}
            >
              <IconChecklist className="size-4" />
              <span>Hồ sơ khởi động ({kickoffReadyCount}/4)</span>
            </button>

            {/* Button 2: Checklist Handover & Close Project Drawer */}
            <button
              type="button"
              onClick={() => setHandoverDrawerOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                contract.phase === "CLOSED"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              {contract.phase === "CLOSED" ? (
                <IconLock className="size-4 text-emerald-600" />
              ) : (
                <IconLockOpen className="size-4 text-slate-500" />
              )}
              <span>Bàn giao & Đóng DA ({handoverReadyCount}/3)</span>
            </button>

            {/* Quick Link to Menu 3: Financials */}
            <button
              type="button"
              onClick={() => setActiveScreen("billing-vat")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              title="Mở màn hình Thu tiền theo Mốc, VAT & Quỹ thưởng 50/50"
            >
              <span>
                Thu tiền ({paidInstallmentCount}/{contract.installments.length})
              </span>
              <IconArrowUpRight className="size-4 text-slate-400" />
            </button>

            {/* Primary Button: + Thêm Mốc bàn giao */}
            <Button
              onClick={() => setAddScopeOpen(true)}
              className="h-9 px-3.5 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white gap-1.5 rounded-lg"
            >
              <IconPlus className="size-4" />
              Thêm Mốc
            </Button>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE CANVAS: SINGLE FLAT 1-LINE SCOPE MILESTONES TABLE */}
      <div className="flex-1 px-6 lg:px-8 py-6 w-full space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Card Header with Clean Monochrome Metrics Strip */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-white">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-semibold text-slate-900">
                  Bảng Cân Đối 4 Chỉ Số Theo Từng Mốc Bàn Giao
                </h2>
                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                  {metrics.acceptedScopeCount}/{metrics.totalScopeCount} Mốc hoàn thành
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bấm vào bất kỳ dòng Mốc bàn giao (M1, M2, M3...) nào để mở khay Cập nhật ngày công, Hoàn thành Mốc hoặc ghi nhận Phát sinh (Tính phí / Hỗ trợ 0đ ≤ 1 ngày).
              </p>
            </div>

            {/* Clean Neutral Summary Strip */}
            <div className="flex flex-wrap items-center gap-5 text-sm">
              <div className="text-slate-500">
                PM tổng:{" "}
                <strong className="font-semibold text-slate-900">
                  {contract.pmOwner.split("(")[0].trim()}
                </strong>
              </div>

              {roleView !== "PM" && (
                <>
                  <div className="text-slate-500">
                    Quỹ dự phòng 50%:{" "}
                    <strong className="font-semibold text-slate-900 tabular-nums">
                      {metrics.cumulativeRiskReserveMd >= 0
                        ? `+${metrics.cumulativeRiskReserveMd} ngày`
                        : `${metrics.cumulativeRiskReserveMd} ngày`}{" "}
                      ({formatMoney(metrics.netRiskPoolAfterMilestoneLossVnd)})
                    </strong>
                  </div>

                  <div className="text-slate-500">
                    Thưởng 50% đã mở khóa:{" "}
                    <strong className="font-semibold text-emerald-700 tabular-nums">
                      {formatMoney(metrics.unlockedBonusPoolVnd)}
                    </strong>
                  </div>
                </>
              )}

              <div className="text-slate-500">
                Hỗ trợ 0đ (1:1 • Cột riêng):{" "}
                <strong className="font-semibold text-slate-900 tabular-nums">
                  {metrics.totalFreeSupportRealMd} ngày ({metrics.totalFreeSupportCount} lần)
                </strong>
              </div>
            </div>
          </div>

          {/* Clean 14px Monochrome Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                  <th className="py-3 pl-5 pr-3 font-medium">Trạng thái</th>
                  <th className="py-3 px-3 font-medium">Mã</th>
                  <th className="py-3 px-3 font-medium">Tên Mốc bàn giao</th>
                  <th className="py-3 px-3 font-medium">Người phụ trách</th>
                  <th className="py-3 px-3 font-medium">Hạn bàn giao</th>
                  <th className="py-3 px-3 text-right font-medium">
                    Tiến độ Ngày công (Thực tiêu / Trần)
                  </th>
                  <th className="py-3 px-3 text-right font-medium">
                    Hỗ trợ 0đ (1:1)
                  </th>
                  <th className="py-3 px-3 text-right font-medium">
                    Số dư Quỹ
                  </th>
                  {roleView !== "PM" && (
                    <th className="py-3 pl-3 pr-5 text-right font-medium">
                      Thưởng 50% (Cách B)
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-sm">
                {contract.scopeItems.map((scopeItem, idx) => {
                  const four = getMilestoneFourMetrics(scopeItem, contract)
                  const picName = scopeItem.ownerPic || contract.pmOwner
                  const handoverEstMd = Number(
                    scopeItem.handoverEstimatedMandays ?? 2
                  )
                  const codeEstMd = Math.max(
                    0,
                    four.estimateMandays - handoverEstMd
                  )

                  const isFinished = four.isFinished
                  const isInProgress =
                    !isFinished &&
                    (scopeItem.status === "IN_PROGRESS" ||
                      four.realMandays > 0)

                  const remainingMd =
                    roleView === "PM"
                      ? four.balanceVsTargetMandays
                      : four.balanceVsLimitMandays
                  const burnPct =
                    roleView === "PM"
                      ? Math.round(
                          (four.realMandays / Math.max(1, four.targetMandays)) *
                            100
                        )
                      : Math.round(
                          (four.realMandays / Math.max(1, four.limitMandays)) *
                            100
                        )
                  const isOver = remainingMd < 0

                  const scopeCrs = contract.changeRequests.filter(
                    (cr) => cr.milestoneId === scopeItem.id
                  )

                  return (
                    <tr
                      key={scopeItem.id}
                      onClick={() => handleOpenScopeDrawer(scopeItem)}
                      className="hover:bg-slate-50/90 cursor-pointer transition-colors group whitespace-nowrap"
                    >
                      {/* 1. Status Pill */}
                      <td className="py-3.5 pl-5 pr-3">
                        {isFinished ? (
                          <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                            <IconCheck className="size-3.5" />
                            Hoàn thành
                          </span>
                        ) : isOver ? (
                          <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200/70">
                            Vượt trần
                          </span>
                        ) : isInProgress ? (
                          <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-800">
                            Đang làm
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-500">
                            Chưa bắt đầu
                          </span>
                        )}
                      </td>

                      {/* 2. Mã Mốc (M1, M2, M3...) */}
                      <td className="py-3.5 px-3 font-mono text-xs font-semibold text-slate-600">
                        {scopeItem.code || `M${idx + 1}`}
                      </td>

                      {/* 3. Tên Mốc bàn giao */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 group-hover:underline">
                            {scopeItem.title}
                          </span>
                          {scopeCrs.length > 0 && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              +{scopeCrs.length} Phát sinh
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Người phụ trách */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <PersonAvatar name={picName} />
                          <span className="text-slate-700">
                            {picName.split("(")[0].trim()}
                          </span>
                        </div>
                      </td>

                      {/* 5. Hạn bàn giao */}
                      <td className="py-3.5 px-3 tabular-nums text-slate-600">
                        {scopeItem.dueDate || "—"}
                      </td>

                      {/* 6. Tiến độ Ngày công (Thực tiêu / Trần) */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="inline-flex flex-col items-end gap-1">
                          <div className="flex items-center justify-end gap-2.5 tabular-nums">
                            <span
                              className={cn(
                                "font-semibold",
                                four.isOverLimit
                                  ? "text-red-600"
                                  : "text-slate-900"
                              )}
                            >
                              {four.realMandays}
                              <span className="text-slate-500 font-normal">
                                {" "}
                                /{" "}
                                {roleView === "PM"
                                  ? `${four.targetMandays} ngày`
                                  : `${four.limitMandays} ngày`}
                              </span>
                            </span>
                            <MandayBulletBar
                              realMd={four.realMandays}
                              targetMd={four.targetMandays}
                              limitMd={four.limitMandays}
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
                            Giao PM: {four.targetMandays}d • Ước tính:{" "}
                            {four.estimateMandays}d ({codeEstMd} code +{" "}
                            {handoverEstMd} BG)
                          </span>
                        </div>
                      </td>

                      {/* 6b. Cột riêng: Hỗ trợ 0đ (1:1, tối đa 1 MD Dev/mốc) */}
                      <td className="py-3.5 px-3 text-right tabular-nums">
                        {four.supportMandays > 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border",
                              four.supportMandays >=
                                FREE_SUPPORT_MAX_MD_PER_MILESTONE
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            )}
                          >
                            {four.supportMandays} / {FREE_SUPPORT_MAX_MD_PER_MILESTONE}d
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">0 / {FREE_SUPPORT_MAX_MD_PER_MILESTONE}d</span>
                        )}
                      </td>

                      {/* 7. Số dư Quỹ */}
                      <td className="py-3.5 px-3 text-right tabular-nums">
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

                      {/* 8. Thưởng 50% (Cách B) */}
                      {roleView !== "PM" && (
                        <td className="py-3.5 pl-3 pr-5 text-right tabular-nums">
                          {four.bonusUnlockStatus === "UNLOCKED" ? (
                            <span className="font-medium text-emerald-700">
                              +{formatMoney(four.teamBonus50Vnd)} (Đã mở)
                            </span>
                          ) : four.bonusUnlockStatus === "PENDING_PAYMENT" ? (
                            <span className="text-slate-600">
                              +{formatMoney(four.teamBonus50Vnd)} (Chờ TT)
                            </span>
                          ) : four.bonusUnlockStatus === "OVER_LIMIT" ? (
                            <span className="font-medium text-red-600">
                              Trừ quỹ ({four.surplusMandays} ngày)
                            </span>
                          ) : (
                            <span className="text-slate-500">
                              +{formatMoney(four.teamBonus50Vnd)}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DRAWER 1: CHI TIẾT MỐC BÀN GIAO (M1, M2, M3...) KHI CLICK VÀO DÒNG     */}
      {/* ===================================================================== */}
      <Sheet
        open={!!activeScope}
        onOpenChange={(open) => !open && setSelectedScopeId(null)}
      >
        <SheetContent className="w-full sm:!max-w-2xl overflow-y-auto p-6">
          {activeScope &&
            (() => {
              const four = getMilestoneFourMetrics(activeScope, contract)
              const picName = activeScope.ownerPic || contract.pmOwner
              const handoverEstMd = Number(
                activeScope.handoverEstimatedMandays ?? 2
              )
              const codeEstMd = Math.max(
                0,
                four.estimateMandays - handoverEstMd
              )
              const linkedInst = four.linkedInstallments[0]
              const scopeCrs = contract.changeRequests.filter(
                (cr) => cr.milestoneId === activeScope.id
              )
              const usedFreeOnScope = getMilestoneFreeSupportUsedMd(
                contract,
                activeScope.id
              )
              const remainingFreeOnScope = Math.max(
                0,
                Number(
                  (FREE_SUPPORT_MAX_MD_PER_MILESTONE - usedFreeOnScope).toFixed(
                    2
                  )
                )
              )
              const isFinished = four.isFinished

              return (
                <div className="space-y-5 pb-8">
                  <SheetHeader className="p-0 border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-2 pr-8">
                      <span className="rounded bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white whitespace-nowrap shrink-0">
                        {activeScope.code}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "whitespace-nowrap shrink-0 text-xs font-medium",
                          isFinished
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        )}
                      >
                        {isFinished
                          ? "Hoàn thành (Đã nghiệm thu)"
                          : "Đang triển khai"}
                      </Badge>
                    </div>
                    <SheetTitle className="text-lg font-bold text-slate-900 mt-1.5 leading-snug">
                      {activeScope.title}
                    </SheetTitle>
                    <SheetDescription className="text-sm text-slate-600 mt-0.5">
                      Người phụ trách: <strong className="text-slate-900">{picName}</strong> • Hạn bàn giao:{" "}
                      <strong className="text-slate-900">{activeScope.dueDate || "Chưa gán"}</strong>
                    </SheetDescription>
                  </SheetHeader>

                  {/* 4 CHỈ SỐ NGÀY CÔNG CỦA MỐC */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {roleView !== "PM" && (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                        <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
                          1. Trần tối đa
                        </div>
                        <div className="text-lg font-bold font-mono text-slate-900 mt-1 whitespace-nowrap">
                          {four.limitMandays} ngày
                        </div>
                      </div>
                    )}
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        2. Mức giao PM
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-900 mt-1 whitespace-nowrap">
                        {four.targetMandays} ngày
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        3. PM ước tính
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-900 mt-1 whitespace-nowrap">
                        {four.estimateMandays} ngày
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {codeEstMd} lập trình + {handoverEstMd} bàn giao
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
                      <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
                        4. Thực tế tiêu
                      </div>
                      <div className="text-lg font-bold font-mono text-slate-900 mt-1 whitespace-nowrap">
                        {four.realMandays} ngày
                      </div>
                    </div>
                  </div>

                  {/* CỘT RIÊNG: HỖ TRỢ 0Đ THEO MỐC */}
                  <div className="rounded-lg border border-blue-200/80 bg-blue-50/40 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-semibold text-blue-950">
                        Hỗ trợ 0đ (Cột riêng • Tỉ lệ 1:1):
                      </span>{" "}
                      <span className="text-blue-800">
                        Không trừ vào Thực tế tiêu (Real) / thưởng 50/50
                      </span>
                    </div>
                    <span className="font-mono font-bold text-blue-900 whitespace-nowrap">
                      {usedFreeOnScope} / {FREE_SUPPORT_MAX_MD_PER_MILESTONE} ngày
                      (Còn {remainingFreeOnScope}d)
                    </span>
                  </div>

                  {/* CÁC NÚT HÀNH ĐỘNG CHÍNH */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setLogModeOpen(!logModeOpen)}
                      className="h-9 px-3.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white gap-1.5"
                    >
                      <IconPlus className="size-3.5" />
                      Cập nhật ngày công định kỳ
                    </Button>

                    {!isFinished ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          finishMilestone(
                            contract.id,
                            activeScope.id,
                            `Hoàn thành & nghiệm thu mốc ${activeScope.code}`
                          )
                        }
                        className="h-9 px-3.5 text-xs border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 gap-1.5 font-semibold"
                      >
                        <IconCheck className="size-3.5" />
                        Chốt hoàn thành Mốc (Chia 50/50)
                      </Button>
                    ) : (
                      contract.phase !== "CLOSED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReopenModeOpen(!reopenModeOpen)}
                          className="h-9 px-3.5 text-xs border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 gap-1.5 font-semibold"
                        >
                          <IconRefresh className="size-3.5" />
                          Mở lại Mốc (Reopen)
                        </Button>
                      )
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddCrMode(!addCrMode)}
                      className="h-9 px-3.5 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
                    >
                      <IconPlus className="size-3.5" />
                      Phát sinh / Hỗ trợ 0đ
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditScopeMode(!editScopeMode)}
                      className="h-9 px-3 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 sm:ml-auto"
                    >
                      {editScopeMode ? "Đóng sửa chỉ số" : "Sửa 4 chỉ số Mốc"}
                    </Button>
                  </div>

                  {/* Form Mở lại Mốc (Reopen Milestone) */}
                  {reopenModeOpen && isFinished && contract.phase !== "CLOSED" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 space-y-3 text-xs">
                      <div className="text-sm font-bold text-amber-950">
                        Mở lại Mốc {activeScope.code} (Reopen Milestone)
                      </div>
                      <p className="text-amber-900">
                        Chuyển Mốc quay lại trạng thái Đang triển khai để log thêm ngày công xử lý lỗi sau UAT (nếu dự án đang ở giai đoạn Đóng/Bàn giao sẽ tự quay lại Đang triển khai).
                      </p>
                      <div>
                        <Label className="text-xs text-amber-900">
                          Lý do mở lại Mốc *
                        </Label>
                        <Input
                          value={reopenReason}
                          onChange={(e) => setReopenReason(e.target.value)}
                          placeholder="VD: Phát hiện lỗi phát sinh khi khách test UAT thực tế..."
                          className="h-9 text-sm bg-white mt-1"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => setReopenModeOpen(false)}
                        >
                          Hủy
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-amber-700 hover:bg-amber-800 text-white"
                          onClick={() => {
                            reopenMilestone(
                              contract.id,
                              activeScope.id,
                              reopenReason
                            )
                            setReopenReason("")
                            setReopenModeOpen(false)
                          }}
                        >
                          Xác nhận Mở lại Mốc
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Form sửa nhanh 4 chỉ số Mốc */}
                  {editScopeMode && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="text-sm font-bold text-slate-800">
                        Cập nhật Cấu hình & 4 Chỉ Số Mốc ({activeScope.code})
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <Label className="text-xs text-slate-600">Người phụ trách</Label>
                          <Input
                            value={editPic}
                            onChange={(e) => setEditPic(e.target.value)}
                            className="h-9 text-sm bg-white mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">Hạn bàn giao</Label>
                          <Input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="h-9 text-sm bg-white mt-1"
                          />
                        </div>
                        {roleView !== "PM" && (
                          <div>
                            <Label className="text-xs text-slate-600">
                              1. Trần tối đa (Sếp cấp - ngày)
                            </Label>
                            <Input
                              type="number"
                              value={editLimitMd}
                              onChange={(e) => setEditLimitMd(e.target.value)}
                              className="h-9 text-sm bg-white mt-1"
                            />
                          </div>
                        )}
                        <div>
                          <Label className="text-xs text-slate-600">
                            2. Mức giao PM (AM giao - ngày)
                          </Label>
                          <Input
                            type="number"
                            value={editTargetMd}
                            onChange={(e) => setEditTargetMd(e.target.value)}
                            className="h-9 text-sm bg-white mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">
                            3a. Ước tính Lập trình (ngày)
                          </Label>
                          <Input
                            type="number"
                            value={editCodeEstMd}
                            onChange={(e) => setEditCodeEstMd(e.target.value)}
                            className="h-9 text-sm bg-white mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">
                            3b. Ước tính Bàn giao (ngày)
                          </Label>
                          <Input
                            type="number"
                            value={editHandoverEstMd}
                            onChange={(e) =>
                              setEditHandoverEstMd(e.target.value)
                            }
                            className="h-9 text-sm bg-white mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => setEditScopeMode(false)}
                        >
                          Hủy
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white"
                          onClick={handleSaveScopeConfig}
                        >
                          Lưu cấu hình Mốc
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Khay nhập + Cập nhật ngày công định kỳ */}
                  {logModeOpen && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="text-sm font-bold text-slate-900">
                        Ghi nhận ngày công thực tiêu kỳ này cho {activeScope.code}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <Label className="text-xs text-slate-600">
                            Số ngày công tiêu thêm (+ngày)
                          </Label>
                          <Input
                            type="number"
                            step="0.5"
                            value={logDeltaMd}
                            onChange={(e) => setLogDeltaMd(e.target.value)}
                            className="h-9 text-sm bg-white mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">Ngày cập nhật</Label>
                          <Input
                            type="date"
                            value={logDate}
                            onChange={(e) => setLogDate(e.target.value)}
                            className="h-9 text-sm bg-white mt-1"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">
                          Ghi chú tiến độ / Vướng mắc
                        </Label>
                        <Input
                          value={logNote}
                          onChange={(e) => setLogNote(e.target.value)}
                          placeholder="VD: Hoàn thành API + giao diện màn hình chính..."
                          className="h-9 text-sm bg-white mt-1"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => setLogModeOpen(false)}
                        >
                          Đóng
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white"
                          onClick={handleSubmitPeriodicLog}
                        >
                          Xác nhận cộng +{logDeltaMd} ngày
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Khay thêm Phát sinh (Phụ lục thu phí / Hỗ trợ 0đ <= 1 ngày) */}
                  {addCrMode && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="text-sm font-bold text-slate-900">
                        Ghi nhận Phát sinh / Hỗ trợ 0đ trên mốc{" "}
                        {activeScope.code}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCrType("FREE_SUPPORT")
                            setCrDevMd(
                              remainingFreeOnScope > 0
                                ? String(Math.min(0.5, remainingFreeOnScope))
                                : "0.5"
                            )
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors",
                            crType === "FREE_SUPPORT"
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          Hỗ trợ 0đ (1:1 • Còn {remainingFreeOnScope}/{FREE_SUPPORT_MAX_MD_PER_MILESTONE}d)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCrType("UPSELL")
                            setCrDevMd("5")
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors",
                            crType === "UPSELL"
                              ? "bg-slate-900 text-white border-slate-900"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                          )}
                        >
                          Phụ lục thu phí (&gt; 1 ngày)
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <Label className="text-xs text-slate-600">
                            Nội dung khách hàng yêu cầu thêm
                          </Label>
                          <Input
                            value={crTitle}
                            onChange={(e) => setCrTitle(e.target.value)}
                            placeholder="VD: Thêm cột xuất Excel báo cáo..."
                            className="h-9 text-sm bg-white mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-slate-600">
                              {crType === "FREE_SUPPORT"
                                ? `Ngày công Dev (1:1 • Còn lại tối đa ${remainingFreeOnScope} MD)`
                                : "Khối lượng ước tính (ngày)"}
                            </Label>
                            <Input
                              type="number"
                              step="0.25"
                              value={crDevMd}
                              onChange={(e) => setCrDevMd(e.target.value)}
                              className="h-9 text-sm bg-white mt-1"
                            />
                          </div>
                          {crType === "UPSELL" && (
                            <div>
                              <Label className="text-xs text-slate-600">
                                Giá báo khách (VNĐ)
                              </Label>
                              <Input
                                type="number"
                                value={crQuoteVnd}
                                onChange={(e) => setCrQuoteVnd(e.target.value)}
                                className="h-9 text-sm bg-white mt-1"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => setAddCrMode(false)}
                        >
                          Hủy
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white"
                          onClick={handleSubmitScopeCr}
                        >
                          Lưu phát sinh
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* CƠ CHẾ QUYẾT TOÁN 50/50 LUÂN CHUYỂN CỦA MỐC NÀY (CÁCH B) */}
                  {roleView !== "PM" && (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          Cơ chế Quỹ Thưởng & Dự Phòng 50/50
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700 whitespace-nowrap">
                          Dôi dư Mốc:{" "}
                          {four.surplusMandays > 0
                            ? `+${four.surplusMandays} ngày`
                            : `${four.surplusMandays} ngày`}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                          <div className="text-xs text-slate-700 font-semibold">
                            50% Đưa vào Quỹ Dự phòng Rủi ro Dự án
                          </div>
                          <div className="text-sm font-mono font-bold text-slate-900 mt-1">
                            +{four.riskReserve50Md} ngày (
                            {formatMoney(four.riskBuffer50Vnd)})
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Giữ lại để bù trừ nếu Mốc sau vượt trần
                          </div>
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                          <div className="text-xs text-emerald-800 font-semibold">
                            50% Thưởng Đội Dự Án (Theo Mốc)
                          </div>
                          <div className="text-sm font-mono font-bold text-emerald-900 mt-1">
                            +{four.bonusSplit50Md} ngày (
                            {formatMoney(four.teamBonus50Vnd)})
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            {four.bonusUnlockStatus === "UNLOCKED"
                              ? "✓ Đã mở khóa — Đủ điều kiện chi ngay (Đợt liên kết đã PAID)"
                              : "Chi ngay 50% thưởng khi Mốc Finish và Đợt liên kết đạt PAID"}
                          </div>
                        </div>
                      </div>

                      {linkedInst && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-500">
                              Đợt thanh toán liên kết:{" "}
                            </span>
                            <strong className="text-slate-800">
                              {linkedInst.name}
                            </strong>{" "}
                            <span className="font-mono text-slate-600">
                              ({formatMoney(linkedInst.amount)})
                            </span>
                          </div>
                          {linkedInst.paymentStatus === "PAID" ? (
                            <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 whitespace-nowrap shrink-0">
                              ✓ Khách đã thanh toán
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                              onClick={() =>
                                updateInstallment(contract.id, linkedInst.id, {
                                  paymentStatus: "PAID",
                                  paidDate: new Date()
                                    .toISOString()
                                    .slice(0, 10),
                                })
                              }
                            >
                              Xác nhận khách đã TT → Mở khóa thưởng
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* DANH SÁCH PHÁT SINH / HỖ TRỢ 0Đ TRÊN MỐC NÀY */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        Phát sinh & Hỗ trợ 0đ tại {activeScope.code} (
                        {scopeCrs.length})
                      </span>
                    </div>
                    {scopeCrs.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                        Chưa có yêu cầu phát sinh (Phụ lục thu phí / Hỗ trợ 0đ) nào tại mốc này.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {scopeCrs.map((cr) => {
                          const statusLabel =
                            cr.status === "APPROVED_FREE_GOODWILL"
                              ? "Đã duyệt hỗ trợ 0đ"
                              : cr.status === "APPROVED_UPSELL"
                                ? "Đã ký phụ lục"
                                : cr.status === "REJECTED"
                                  ? "Từ chối"
                                  : "Đang báo giá"
                          return (
                            <div
                              key={cr.id}
                              className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 leading-snug">
                                  {cr.code}: {cr.title}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Loại:{" "}
                                  {cr.crType === "FREE_SUPPORT"
                                    ? "Hỗ trợ 0đ (1:1 • ≤ 1 MD/mốc)"
                                    : "Phụ lục thu phí"}{" "}
                                  • Khối lượng:{" "}
                                  <strong className="text-slate-700">
                                    {cr.pmEstimatedMandays} ngày
                                  </strong>
                                </div>
                              </div>
                              {cr.status === "AM_QUOTING" ||
                              cr.status === "PM_ESTIMATING" ? (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shrink-0"
                                  onClick={() =>
                                    resolveChangeRequest(
                                      contract.id,
                                      cr.id,
                                      "APPROVED_UPSELL",
                                      cr.quotedPriceVnd,
                                      cr.amAllocatedToPmMandays,
                                      true
                                    )
                                  }
                                >
                                  Duyệt phụ lục (+Trần ngày)
                                </Button>
                              ) : (
                                <span
                                  className={cn(
                                    "rounded px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0",
                                    cr.status === "APPROVED_FREE_GOODWILL"
                                      ? "bg-slate-200/80 text-slate-800"
                                      : cr.status === "APPROVED_UPSELL"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-slate-100 text-slate-600"
                                  )}
                                >
                                  {statusLabel}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* NHẬT KÝ CẬP NHẬT NGÀY CÔNG CỦA MỐC */}
                  <div className="space-y-2.5">
                    <div className="text-sm font-bold text-slate-900">
                      Nhật ký cập nhật ngày công (
                      {(activeScope.progressLogs || []).length})
                    </div>
                    {(activeScope.progressLogs || []).length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                        Chưa có lịch sử cập nhật ngày công cho mốc này.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {(activeScope.progressLogs || []).map((log) => (
                          <div
                            key={log.id}
                            className="rounded-lg border border-slate-200 bg-white p-3.5 text-xs flex items-start justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 leading-snug">
                                {log.note}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {log.updatedAt} • Bởi: {log.updatedBy}
                              </div>
                            </div>
                            <span className="rounded bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800 whitespace-nowrap shrink-0">
                              {log.deltaMandays
                                ? `+${log.deltaMandays} ngày`
                                : `${log.newActualMandays} ngày`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
        </SheetContent>
      </Sheet>

      {/* ===================================================================== */}
      {/* DRAWER 2: CHECKLIST KHỞI ĐỘNG & DRIVE SETUP (4 ĐIỀU KIỆN)              */}
      {/* ===================================================================== */}
      <Sheet open={kickoffDrawerOpen} onOpenChange={setKickoffDrawerOpen}>
        <SheetContent className="w-full sm:!max-w-lg overflow-y-auto p-6">
          <SheetHeader className="p-0 border-b border-slate-200 pb-4 pr-6">
            <SheetTitle className="text-lg font-bold text-slate-900">
              Hồ sơ khởi động dự án ({kickoffReadyCount}/4 hoàn tất)
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-600">
              Đảm bảo đủ 4 điều kiện chuẩn hóa trước khi chuyển dự án sang giai đoạn Đang triển khai.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 py-4 text-sm">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={kickoffEval.isDriveReady}
                onCheckedChange={(v) => {
                  const val = Boolean(v)
                  toggleDriveVerified(contract.id, val)
                  updateKickoffChecklist(contract.id, {
                    driveRootCreated: val,
                    driveTeamDocCreated: val,
                    driveSharedDocCreated: val,
                    drivePermissionsGranted: val,
                  })
                }}
              />
              <div>
                <div className="font-semibold text-slate-900">
                  1. Đã khởi tạo Google Drive chuẩn 3 thư mục & Phân quyền
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <IconBrandGoogleDrive className="size-4 text-emerald-600" />
                  <span>Thư mục gốc HĐ, Tài liệu nội bộ & Tài liệu chia sẻ khách hàng</span>
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={kickoffEval.isProjectDocReady}
                onCheckedChange={(v) =>
                  updateKickoffChecklist(contract.id, {
                    pmConfirmedScope: Boolean(v),
                  })
                }
              />
              <div>
                <div className="font-semibold text-slate-900">
                  2. PM đã xác nhận hiểu rõ phạm vi & Bảng 4 chỉ số Mốc bàn giao
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Hiện có {contract.scopeItems.length} Mốc bàn giao trong dự án.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={kickoffEval.isTimelineReady}
                onCheckedChange={(v) =>
                  updateKickoffChecklist(contract.id, {
                    kickoffTimelineConfirmed: Boolean(v),
                  })
                }
              />
              <div>
                <div className="font-semibold text-slate-900">
                  3. Đã chốt lộ trình & Lịch họp khởi động với Khách hàng
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Ngày bắt đầu: {contract.startDate}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={kickoffEval.isHandoverEstimateReady}
                onCheckedChange={(v) =>
                  updateKickoffChecklist(contract.id, {
                    handoverEstimateConfirmed: Boolean(v),
                    handoverEstimateMandays: v ? 4 : 0,
                  })
                }
              />
              <div>
                <div className="font-semibold text-slate-900">
                  4. Đã tính đủ thời gian Bàn giao & Đào tạo trong cột 3. PM ước tính
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Tổng thời gian bàn giao đã tính: {totalHandoverEstMd} ngày.
                </div>
              </div>
            </label>

            {roleView === "BOD" && !contract.bodAllowKickoffWithoutAdvance && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => approveKickoffByBod(contract.id)}
                className="w-full h-9 text-xs border-amber-300 bg-amber-50 text-amber-900"
              >
                Ban Giám Đốc phê duyệt ngoại lệ cho phép khởi động dự án
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ===================================================================== */}
      {/* DRAWER 3: CHECKLIST BÀN GIAO & ĐÓNG DỰ ÁN                              */}
      {/* ===================================================================== */}
      <Sheet open={handoverDrawerOpen} onOpenChange={setHandoverDrawerOpen}>
        <SheetContent className="w-full sm:!max-w-lg overflow-y-auto p-6">
          <SheetHeader className="p-0 border-b border-slate-200 pb-4 pr-6">
            <SheetTitle className="text-lg font-bold text-slate-900">
              Bàn giao & Quyết toán Đóng dự án ({handoverReadyCount}/3)
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-600">
              Hoàn tất 3 bước bàn giao kỹ thuật, biên bản nghiệm thu và thu đủ công nợ/VAT trước khi khóa sổ dự án.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-3 py-4 text-sm">
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={contract.handover.sourceCodeDelivered}
                onCheckedChange={(v) =>
                  updateHandover(contract.id, {
                    sourceCodeDelivered: Boolean(v),
                  })
                }
              />
              <div>
                <div className="font-semibold text-slate-900">
                  1. Đã bàn giao mã nguồn / Hệ thống vận hành chính thức
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Đã chuyển giao cho đầu mối kỹ thuật phía khách hàng.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={contract.handover.userGuideAndVideoDelivered}
                onCheckedChange={(v) =>
                  updateHandover(contract.id, {
                    userGuideAndVideoDelivered: Boolean(v),
                  })
                }
              />
              <div>
                <div className="font-semibold text-slate-900">
                  2. Đã bàn giao Tài liệu HDSD & Video Đào tạo
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Lưu trữ trong thư mục Tài liệu chia sẻ khách hàng.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={contract.handover.signedAcceptanceScanUploaded}
                onCheckedChange={(v) =>
                  updateHandover(contract.id, {
                    signedAcceptanceScanUploaded: Boolean(v),
                  })
                }
              />
              <div>
                <div className="font-semibold text-slate-900">
                  3. Đã tải lên Bản Scan Biên Bản Nghiệm Thu Tổng Thể
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Mốc đã hoàn thành: {metrics.acceptedScopeCount}/{metrics.totalScopeCount} • Đợt đã thu:{" "}
                  {paidInstallmentCount}/{contract.installments.length}
                </div>
              </div>
            </label>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-slate-900">
                Điều kiện mở khóa Đóng dự án (Gatekeeper #2)
              </div>
              <div className="space-y-1.5">
                {[
                  {
                    ok: metrics.scopeAcceptancePercent === 100,
                    text: `100% Mốc đã Finish (${metrics.acceptedScopeCount}/${metrics.totalScopeCount})`,
                  },
                  {
                    ok: metrics.isHandoverComplete,
                    text: `Đủ 3/3 Checklist Bàn giao (${handoverReadyCount}/3)`,
                  },
                  {
                    ok: metrics.isAllInstallmentsPaid,
                    text: `Thu đủ 100% Đợt thanh toán (${paidInstallmentCount}/${contract.installments.length} PAID)`,
                  },
                  {
                    ok: metrics.isAllVatIssued,
                    text: "Xuất đủ 100% Hóa đơn VAT (Số HĐ + File)",
                  },
                  {
                    ok: metrics.isAllAmExpensesReimbursed,
                    text: metrics.isAllAmExpensesReimbursed
                      ? "Tất toán 100% Sổ chi công tác AM (REIMBURSED)"
                      : `Còn ${metrics.unreimbursedExpensesCount} khoản chi AM chưa REIMBURSED (chặn đóng)`,
                  },
                ].map((cond, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex items-center gap-2",
                      cond.ok ? "text-emerald-700" : "text-red-700 font-medium"
                    )}
                  >
                    <span>{cond.ok ? "✓" : "✕"}</span>
                    <span>{cond.text}</span>
                  </div>
                ))}
              </div>
              {!metrics.isAllAmExpensesReimbursed && (
                <button
                  type="button"
                  onClick={() => {
                    setHandoverDrawerOpen(false)
                    setActiveScreen("am-expenses")
                  }}
                  className="text-xs font-semibold text-primary hover:underline pt-1"
                >
                  Mở Sổ Chi Phí AM để Kế toán chốt hoàn ứng →
                </button>
              )}
            </div>

            <div className="pt-2">
              <Button
                size="sm"
                disabled={
                  contract.phase === "CLOSED" ||
                  !metrics.canCloseProject ||
                  roleView === "PM"
                }
                onClick={() => closeProjectAndSettleKpi(contract.id)}
                className="w-full h-10 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-50"
              >
                {contract.phase === "CLOSED"
                  ? "✓ Dự án đã đóng & Quyết toán hoàn tất"
                  : !metrics.canCloseProject
                  ? "Chưa đủ 5 điều kiện Gatekeeper #2 để Đóng Dự Án"
                  : "Chốt Quyết Toán 50/50 & Đóng Dự Án"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===================================================================== */}
      {/* DIALOG: + THÊM MỐC BÀN GIAO MỚI                                      */}
      {/* ===================================================================== */}
      <Dialog open={addScopeOpen} onOpenChange={setAddScopeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Thêm Mốc Bàn Giao Mới
            </DialogTitle>
            <DialogDescription className="text-xs">
              Thiết lập 4 chỉ số (1. Trần tối đa • 2. Mức giao PM • 3. PM ước tính • 4. Thực tế) và người phụ trách cho Mốc.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Mã Mốc (VD: M4)</Label>
              <Input
                value={newScopeCode}
                onChange={(e) => setNewScopeCode(e.target.value)}
                placeholder={`M${contract.scopeItems.length + 1}`}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Hạn bàn giao</Label>
              <Input
                type="date"
                value={newScopeDueDate}
                onChange={(e) => setNewScopeDueDate(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Tên Mốc bàn giao *</Label>
              <Input
                value={newScopeTitle}
                onChange={(e) => setNewScopeTitle(e.target.value)}
                placeholder="VD: Giai đoạn 4 - Tích hợp ứng dụng di động & Nghiệm thu"
                className="h-8 text-xs mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Người phụ trách</Label>
              <Select value={newScopePic} onValueChange={setNewScopePic}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIC_SUGGESTIONS.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">1. Trần tối đa (Sếp cấp - ngày)</Label>
              <Input
                type="number"
                value={newScopeLimitMd}
                onChange={(e) => setNewScopeLimitMd(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-slate-900 font-semibold">
                2. Mức giao PM (AM giao - ngày)
              </Label>
              <Input
                type="number"
                value={newScopeTargetMd}
                onChange={(e) => setNewScopeTargetMd(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">3a. Ước tính lập trình (ngày)</Label>
              <Input
                type="number"
                value={newScopeCodeEstMd}
                onChange={(e) => setNewScopeCodeEstMd(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">3b. Ước tính bàn giao (ngày)</Label>
              <Input
                type="number"
                value={newScopeHandoverEstMd}
                onChange={(e) => setNewScopeHandoverEstMd(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Giá trị phân bổ (VNĐ)</Label>
              <Input
                type="number"
                value={newScopePrice}
                onChange={(e) => setNewScopePrice(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Thuế suất VAT</Label>
              <Select
                value={newScopeVat}
                onValueChange={(v) => setNewScopeVat(v as VatCategory)}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VAT_10" className="text-xs">
                    VAT 10%
                  </SelectItem>
                  <SelectItem value="VAT_8" className="text-xs">
                    VAT 8%
                  </SelectItem>
                  <SelectItem value="NON_VAT" className="text-xs">
                    Không chịu thuế (0%)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddScopeOpen(false)}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleCreateScopeItem}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              Tạo Mốc bàn giao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================== */}
      {/* DIALOG: GẮN NHÃN TAG TỰ DO CHO DỰ ÁN                                  */}
      {/* ===================================================================== */}
      <Dialog open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Nhãn Cảnh Báo Dự Án ({contract.contractCode})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAG_SUGGESTIONS.map((tag) => {
                const active = (contract.amCustomTags || []).includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      active
                        ? removeContractTag(contract.id, tag)
                        : addContractTag(contract.id, tag)
                    }
                    className={cn(
                      "px-2.5 py-1 rounded border text-xs font-medium",
                      active
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 text-slate-700 border-slate-200"
                    )}
                  >
                    {active ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <Input
                value={newTagDraft}
                onChange={(e) => setNewTagDraft(e.target.value)}
                placeholder="Nhập nhãn khác..."
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white"
                onClick={() => {
                  if (!newTagDraft.trim()) return
                  addContractTag(contract.id, newTagDraft.trim())
                  setNewTagDraft("")
                }}
              >
                Thêm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
