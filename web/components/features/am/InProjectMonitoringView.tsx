"use client"

import * as React from "react"
import {
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconFlagCheck,
  IconHistory,
  IconPlus,
  IconScale,
  IconUserCheck,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import {
  calculateContractMetrics,
  ChangeRequestItem,
  ChangeRequestStatus,
  ChangeRequestType,
  getMilestoneFourMetrics,
  ScopeExecutionStatus,
  ScopeItem,
  ScopeProgressLog,
  VatCategory,
} from "@/lib/mock/am-types"

const CR_STATUS_BADGE: Record<
  ChangeRequestStatus,
  { label: string; className: string }
> = {
  PM_ESTIMATING: {
    label: "Chờ PM Estimate",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  AM_QUOTING: {
    label: "Đang báo giá Upsell",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  APPROVED_UPSELL: {
    label: "Đã ký Phụ lục Upsell",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  APPROVED_FREE_GOODWILL: {
    label: "Hỗ trợ 0đ (Đã Log MD)",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
}

const SCOPE_STATUS_BADGE: Record<
  ScopeExecutionStatus,
  { label: string; className: string }
> = {
  NOT_STARTED: {
    label: "Chưa mở mốc",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  IN_PROGRESS: {
    label: "Đang tiêu hao Credit",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  COMPLETED: {
    label: "Đã Finish Milestone",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  DELAYED: {
    label: "Đang nghẽn / Trễ hạn",
    className: "bg-red-50 text-red-600 border-red-200",
  },
}

export function InProjectMonitoringView() {
  const {
    selectedContract,
    roleView,
    hidePrice,
    togglePriceVisible,
    formatMoney,
    logMilestoneMandays,
    finishMilestone,
    addChangeRequest,
    resolveChangeRequest,
  } = useAmPrototype()

  const metrics = calculateContractMetrics(selectedContract)

  // Modal Log Mandays định kỳ (In/Out Account Balance - KHÔNG nhập % tiến độ)
  const [loggingScopeItem, setLoggingScopeItem] = React.useState<ScopeItem | null>(
    null
  )
  const [logMode, setLogMode] = React.useState<"ADD_DELTA" | "SET_CUMULATIVE">(
    "ADD_DELTA"
  )
  const [deltaMdInput, setDeltaMdInput] = React.useState<number>(5)
  const [cumulativeMdInput, setCumulativeMdInput] = React.useState<number>(0)
  const [logCheckDate, setLogCheckDate] = React.useState<string>("2026-10-29")
  const [logReasonNote, setLogReasonNote] = React.useState<string>("")
  const [logBlockerNote, setLogBlockerNote] = React.useState<string>("")

  // Modal xác nhận bấm "Finish Milestone" (Tự tính dôi dư & chia 50/50)
  const [finishingScopeItem, setFinishingScopeItem] =
    React.useState<ScopeItem | null>(null)
  const [finishSummaryNote, setFinishSummaryNote] = React.useState<string>("")

  const [expandedHistoryStoneIds, setExpandedHistoryStoneIds] = React.useState<
    Record<string, boolean>
  >({})

  // Modal Tạo Yêu Cầu Phát Sinh (Nhúng thẳng vào Mốc đang chạy: Phân loại UPSELL vs FREE_SUPPORT)
  const [crModalOpen, setCrModalOpen] = React.useState(false)
  const [crMilestoneId, setCrMilestoneId] = React.useState<string>("")
  const [crType, setCrType] = React.useState<ChangeRequestType>("FREE_SUPPORT")
  const [crTitle, setCrTitle] = React.useState("")
  const [crRequestedBy, setCrRequestedBy] = React.useState("Đại diện phía Khách hàng")
  const [crDescription, setCrDescription] = React.useState("")
  const [crDevMd, setCrDevMd] = React.useState<number>(0.5)
  const [crEstimatedMd, setCrEstimatedMd] = React.useState<number>(1.5)
  const [crQuotedPrice, setCrQuotedPrice] = React.useState<number>(28_000_000)
  const [crTimelineDays, setCrTimelineDays] = React.useState<number>(0)
  const [crVatCat, setCrVatCat] = React.useState<VatCategory>("NON_VAT")

  // Modal Duyệt Phụ lục Upsell
  const [approvingCr, setApprovingCr] = React.useState<ChangeRequestItem | null>(
    null
  )
  const [approvedPriceDraft, setApprovedPriceDraft] = React.useState<number>(0)
  const [allocatedToPmDraft, setAllocatedToPmDraft] = React.useState<number>(0)
  const [autoCreateInstallmentDraft, setAutoCreateInstallmentDraft] =
    React.useState<boolean>(true)
  const [upsellDueDateDraft, setUpsellDueDateDraft] = React.useState<string>("")

  const getStoneLogs = React.useCallback(
    (item: ScopeItem): ScopeProgressLog[] => {
      if (item.progressLogs && item.progressLogs.length > 0) {
        return item.progressLogs
      }
      const m4 = getMilestoneFourMetrics(item, selectedContract)
      if (m4.realMandays === 0) return []
      return [
        {
          id: `init-${item.id}`,
          updatedAt: `${item.lastCheckDate || selectedContract.startDate} 09:00`,
          updatedBy: item.ownerPic || selectedContract.pmOwner || "PM Dự án",
          logType: item.isAccepted ? "FINISH_MILESTONE" : "PERIODIC_CHECK",
          status: item.status || (item.isAccepted ? "COMPLETED" : "IN_PROGRESS"),
          deltaMandays: m4.realMandays,
          previousActualMandays: 0,
          newActualMandays: m4.realMandays,
          limitMandaysSnapshot: m4.limitMandays,
          note: item.pmNote || "Ghi nhận số Mandays thực tế tiêu hao tại Mốc",
          blockerNote: item.blockerNote,
        },
      ]
    },
    [selectedContract]
  )

  const toggleStoneHistory = (stoneId: string) => {
    setExpandedHistoryStoneIds((prev) => ({
      ...prev,
      [stoneId]: !prev[stoneId],
    }))
  }

  const handleOpenLogMandaysModal = (item: ScopeItem) => {
    const m4 = getMilestoneFourMetrics(item, selectedContract)
    setLoggingScopeItem(item)
    setLogMode("ADD_DELTA")
    setDeltaMdInput(5)
    setCumulativeMdInput(m4.realMandays + 5)
    setLogCheckDate("2026-10-29")
    setLogReasonNote("")
    setLogBlockerNote(item.blockerNote || "")
  }

  const handleSaveLogMandays = () => {
    if (!loggingScopeItem) return
    if (!logReasonNote.trim()) {
      toast.error(
        "Bắt buộc nhập Lý do / Nội dung công việc tiêu hao Mandays để lưu vào Audit Log!"
      )
      return
    }
    logMilestoneMandays(selectedContract.id, loggingScopeItem.id, {
      deltaMandays: logMode === "ADD_DELTA" ? deltaMdInput : undefined,
      newCumulativeMandays:
        logMode === "SET_CUMULATIVE" ? cumulativeMdInput : undefined,
      checkDate: logCheckDate,
      note: logReasonNote.trim(),
      blockerNote: logBlockerNote.trim() || undefined,
      logType: "PERIODIC_CHECK",
    })
    setExpandedHistoryStoneIds((prev) => ({
      ...prev,
      [loggingScopeItem.id]: true,
    }))
    setLoggingScopeItem(null)
  }

  const handleOpenFinishMilestoneModal = (item: ScopeItem) => {
    const m4 = getMilestoneFourMetrics(item, selectedContract)
    const surplus = m4.limitMandays - m4.realMandays
    setFinishingScopeItem(item)
    setFinishSummaryNote(
      surplus >= 0
        ? `Chốt Finish Milestone tại ${m4.realMandays}/${m4.limitMandays} MD Limit -> Dôi dư +${surplus} MD (50% = +${(surplus / 2).toFixed(1)} MD giữ lại bù rủi ro mốc sau; 50% = +${(surplus / 2).toFixed(1)} MD chia thưởng Team).`
        : `Chốt Finish Milestone tại ${m4.realMandays}/${m4.limitMandays} MD Limit -> Âm quỹ ${surplus} MD.`
    )
  }

  const handleConfirmFinishMilestone = () => {
    if (!finishingScopeItem) return
    finishMilestone(
      selectedContract.id,
      finishingScopeItem.id,
      finishSummaryNote
    )
    setExpandedHistoryStoneIds((prev) => ({
      ...prev,
      [finishingScopeItem.id]: true,
    }))
    setFinishingScopeItem(null)
  }

  const handleOpenCreateCrForMilestone = (
    milestone: ScopeItem,
    defaultType: ChangeRequestType = "FREE_SUPPORT"
  ) => {
    setCrMilestoneId(milestone.id)
    setCrType(defaultType)
    setCrTitle("")
    setCrDescription("")
    if (defaultType === "FREE_SUPPORT") {
      setCrDevMd(0.5)
      setCrEstimatedMd(1.5)
      setCrQuotedPrice(0)
      setCrTimelineDays(0)
    } else {
      setCrDevMd(5)
      setCrEstimatedMd(8)
      setCrQuotedPrice(28_000_000)
      setCrTimelineDays(5)
    }
    setCrModalOpen(true)
  }

  const handleCreateCrSubmit = () => {
    if (!crTitle.trim()) {
      toast.error("Vui lòng nhập nội dung yêu cầu phát sinh / hỗ trợ")
      return
    }
    if (crType === "FREE_SUPPORT" && crDevMd > 1) {
      toast.error(
        "NGHIÊM CẤM hỗ trợ việc vặt quá 1 ngày công của Dev (= 3 MD thực tế)! Vui lòng chuyển sang 'Phát sinh có tính tiền (Upsell)'."
      )
      return
    }

    const targetMs = selectedContract.scopeItems.find(
      (s) => s.id === crMilestoneId
    )

    addChangeRequest(selectedContract.id, {
      milestoneId: crMilestoneId,
      milestoneTitle: targetMs?.title,
      crType,
      title:
        crType === "FREE_SUPPORT" && !crTitle.startsWith("[Hỗ trợ 0đ]")
          ? `[Hỗ trợ 0đ] ${crTitle.trim()}`
          : crTitle.trim(),
      requestedDate: "2026-10-29",
      requestedByClientContact: crRequestedBy,
      description: crDescription || crTitle,
      devMandays: crDevMd,
      pmEstimatedMandays: crEstimatedMd,
      amAllocatedToPmMandays: crType === "FREE_SUPPORT" ? crEstimatedMd : undefined,
      quotedPriceVnd: crType === "FREE_SUPPORT" ? 0 : crQuotedPrice,
      vatCategory: crType === "FREE_SUPPORT" ? "NON_VAT" : crVatCat,
      timelineImpactDays: crTimelineDays,
      status:
        crType === "FREE_SUPPORT" ? "APPROVED_FREE_GOODWILL" : "AM_QUOTING",
      approvedDate: crType === "FREE_SUPPORT" ? "2026-10-29" : undefined,
      amNegotiationNote:
        crType === "FREE_SUPPORT"
          ? `Hỗ trợ miễn phí tại ${targetMs?.code}: Dev làm ${crDevMd} MD -> Thực tế cả Test & Bàn giao = ${crEstimatedMd} MD. Đã ghi nhận làm bằng chứng đàm phán với khách.`
          : `Phát sinh tại ${targetMs?.code}: PM estimate +${crEstimatedMd} MD. AM Thảo đang gửi báo giá ${formatMoney(crQuotedPrice)} cho khách.`,
    })
    setCrModalOpen(false)
  }

  const handleOpenApproveUpsell = (cr: ChangeRequestItem) => {
    setApprovingCr(cr)
    setApprovedPriceDraft(cr.quotedPriceVnd)
    setAllocatedToPmDraft(cr.pmEstimatedMandays)
    setAutoCreateInstallmentDraft(true)
    setUpsellDueDateDraft(selectedContract.expectedEndDate)
  }

  const handleConfirmApproveUpsell = () => {
    if (!approvingCr) return
    resolveChangeRequest(
      selectedContract.id,
      approvingCr.id,
      "APPROVED_UPSELL",
      approvedPriceDraft,
      allocatedToPmDraft,
      autoCreateInstallmentDraft,
      upsellDueDateDraft
    )
    setApprovingCr(null)
  }

  // Câu bằng chứng hỗ trợ miễn phí để AM copy gửi khách
  const goodwillEvidenceText = `Kính gửi Anh/Chị đại diện ${selectedContract.customerName},
Tính đến hôm nay, đội ngũ dự án (${selectedContract.contractCode}) đã hỗ trợ miễn phí ngoài phạm vi hợp đồng cho Quý công ty tổng cộng ${metrics.totalFreeSupportCount} hạng mục (tương đương ${metrics.totalFreeSupportDevMd} ngày công Dev = ${metrics.totalFreeSupportRealMd} Mandays thực tế bao gồm cả kiểm thử và bàn giao).
Do đó, rất mong Anh/Chị hỗ trợ giải ngân đúng hạn các đợt thanh toán tiếp theo và phê duyệt Phụ lục cho các tính năng lớn phát sinh thêm. Trân trọng cảm ơn Anh/Chị!`

  return (
    <div className="space-y-6">
      {/* BÁO ĐỘNG ĐỎ TỰ ĐỘNG KHI REAL > LIMIT (ÂM QUỸ / LỖ) */}
      {metrics.effectiveRealMandays > metrics.totalMaxMandays && (
        <div className="rounded-lg border-2 border-red-600 bg-red-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <IconAlertTriangle className="size-6 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <div className="text-sm font-bold text-red-700">
                BÁO ĐỘNG ĐỎ (ÂM QUỸ TÍN DỤNG CREDIT / LỖ): Thực tế tiêu hao ({metrics.effectiveRealMandays} MD) đã vượt Limit công ty cấp ({metrics.totalMaxMandays} MD)!
              </div>
              <p className="text-red-800">
                Dự án đang âm <strong>{metrics.surplusMandays} Mandays</strong> (tương đương âm{" "}
                <strong>{formatMoney(metrics.overBudgetLossVnd)}</strong>). AM và PM cần lập tức khoanh vùng Scope, dừng toàn bộ hỗ trợ 0 đồng và ép nghiệm thu ngay!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MỤC 2 BIÊN BẢN HỌP: 4 CHỈ SỐ TÀI CHÍNH TỔNG HỢP (LIMIT / TARGET / ESTIMATE / REAL) + QUỸ BÙ RỦI RO & THƯỞNG 50/50 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card className="shadow-none border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>1. Limit (Hạn mức Cty cấp)</span>
              {roleView !== "PM" && (
                <button
                  type="button"
                  onClick={togglePriceVisible}
                  className="text-muted-foreground hover:text-primary"
                >
                  {hidePrice ? (
                    <IconEyeOff className="size-3.5" />
                  ) : (
                    <IconEye className="size-3.5" />
                  )}
                </button>
              )}
            </div>
            <div className="text-2xl font-bold text-foreground mt-1.5">
              {roleView === "PM" ? "Đã ẩn" : `${metrics.totalMaxMandays} MD`}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {roleView === "PM"
                ? "Ẩn theo phân quyền PM"
                : `Ngân sách: ${formatMoney(metrics.totalMaxMandays * selectedContract.standardMandayRate)}`}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none border border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-primary">
              2. Target (Mục tiêu AM ép)
            </div>
            <div className="text-2xl font-bold text-primary mt-1.5">
              {metrics.effectiveTargetMandays} MD
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {roleView === "PM"
                ? "Mốc AM Thảo giao PM"
                : `Nhỏ hơn Limit (+${metrics.amBufferMandays} MD đệm)`}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-card">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">
              3. Estimate (Dự toán PM)
            </div>
            <div className="text-2xl font-bold text-foreground mt-1.5">
              {metrics.effectiveEstimateMandays} MD
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Tổng dự toán kỹ thuật các Mốc
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-card">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground">
              4. Real (Thực tế tiêu hao)
            </div>
            <div
              className={
                metrics.effectiveRealMandays > metrics.totalMaxMandays
                  ? "text-2xl font-bold text-red-600 mt-1.5"
                  : metrics.effectiveRealMandays > metrics.effectiveTargetMandays
                  ? "text-2xl font-bold text-amber-600 mt-1.5"
                  : "text-2xl font-bold text-emerald-700 mt-1.5"
              }
            >
              {metrics.effectiveRealMandays} MD
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Số dư so với Limit:{" "}
              <strong>
                {roleView === "PM"
                  ? `${metrics.effectiveTargetMandays - metrics.effectiveRealMandays} MD (vs Target)`
                  : metrics.surplusMandays >= 0
                  ? `+${metrics.surplusMandays} MD`
                  : `${metrics.surplusMandays} MD (Âm)`}
              </strong>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none border border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4">
            <div className="text-xs font-semibold text-emerald-900 flex items-center gap-1">
              <IconScale className="size-3.5" />
              <span>Phân bổ Dôi dư (50 / 50)</span>
            </div>
            {roleView === "PM" ? (
              <div className="text-xs text-emerald-800 mt-2 leading-snug">
                Khi Finish Milestone có lời: <strong>50%</strong> bù rủi ro mốc sau, <strong>50%</strong> thưởng Team.
              </div>
            ) : metrics.isProfitable ? (
              <div className="space-y-1 mt-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">50% Bù rủi ro mốc sau:</span>
                  <strong className="text-foreground">
                    {formatMoney(metrics.maintenanceAndCompanyFundVnd)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">50% Chia thưởng Team:</span>
                  <strong className="text-emerald-700">
                    {formatMoney(metrics.kpiBonusAmountVnd)}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="text-xs font-bold text-red-600 mt-2">
                Đang âm quỹ: -{formatMoney(metrics.overBudgetLossVnd)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Thanh tổng hợp Bằng chứng Hỗ trợ 0 đồng (Free Support Evidence) cho AM Thảo làm việc với khách */}
      <Card className="shadow-none border border-blue-200 bg-blue-50/40">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-semibold text-blue-950 flex items-center gap-2">
              <Badge className="bg-blue-600 text-white border-0 text-[10px]">
                Bằng chứng Hỗ trợ 0 đồng (Goodwill Ledger)
              </Badge>
              <span>
                Đã hỗ trợ miễn phí cho khách:{" "}
                <strong>
                  {metrics.totalFreeSupportCount} yêu cầu ({metrics.totalFreeSupportDevMd} ngày Dev = {metrics.totalFreeSupportRealMd} ngày công thực tế)
                </strong>
              </span>
            </div>
            <p className="text-blue-900/80 text-[11px]">
              Quy định bắt buộc: <strong>Nghiêm cấm hỗ trợ việc vặt quá 1 ngày công của Dev</strong> (vì 1 ngày Dev làm thì tính cả Test & Bàn giao sẽ thành 3 ngày công thực tế). Mọi hỗ trợ đều phải Log để AM làm bằng chứng đòi thanh toán đúng hạn hoặc ép ký phụ lục.
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white border-blue-300 text-blue-800 hover:bg-blue-50 gap-1.5 shrink-0"
            onClick={() => {
              navigator.clipboard?.writeText(goodwillEvidenceText)
              toast.success(
                "Đã copy văn bản bằng chứng hỗ trợ miễn phí để AM gửi cho khách hàng!"
              )
            }}
          >
            <IconCopy className="size-3.5" />
            Copy bằng chứng hỗ trợ gửi khách ({metrics.totalFreeSupportRealMd} MD)
          </Button>
        </CardContent>
      </Card>

      {/* DANH SÁCH CÁC MỐC BÀN GIAO (SCOPE MILESTONES): Tích hợp 4 chỉ số, Log Mandays, Finish Milestone & Phát sinh ngay trong từng Mốc */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Quản Lý Tài Khoản Tín Dụng Từng Mốc Bàn Giao ({selectedContract.scopeItems.length} Mốc)
            </h2>
            <p className="text-xs text-muted-foreground">
              Không nhập % hoàn thành • Định kỳ vào <strong>Log Mandays</strong> để trừ lùi hạn mức • Bấm <strong>Finish Milestone</strong> khi hoàn tất mốc để hệ thống tự tính Mandays dôi dư (chia 50% bù rủi ro mốc sau / 50% thưởng)
            </p>
          </div>
        </div>

        {selectedContract.scopeItems.map((item, idx) => {
          const m4 = getMilestoneFourMetrics(item, selectedContract)
          const effectiveStatus: ScopeExecutionStatus =
            item.status || (item.isAccepted ? "COMPLETED" : "IN_PROGRESS")
          const statusInfo = SCOPE_STATUS_BADGE[effectiveStatus]
          const stoneLogs = getStoneLogs(item)
          const isHistoryOpen = Boolean(expandedHistoryStoneIds[item.id])

          // Các yêu cầu phát sinh (Upsell & Hỗ trợ 0đ) nằm trực tiếp trong Mốc này
          const milestoneCrs = selectedContract.changeRequests.filter(
            (cr) =>
              cr.milestoneId === item.id ||
              (!cr.milestoneId && idx === 0)
          )

          // Các đợt thanh toán liên kết với Mốc này
          const linkedInstallments = selectedContract.installments.filter(
            (inst) => inst.linkedMilestoneId === item.id
          )

          const burnRatio =
            m4.limitMandays > 0
              ? Math.min(100, Math.round((m4.realMandays / m4.limitMandays) * 100))
              : 0

          return (
            <Card
              key={item.id}
              className={`shadow-none border overflow-hidden ${
                m4.isOverLimit
                  ? "border-red-400 bg-red-50/20"
                  : m4.isFinished
                  ? "border-emerald-300 bg-emerald-50/15"
                  : "bg-card"
              }`}
            >
              <CardContent className="p-5 space-y-4">
                {/* Hàng 1: Tiêu đề Mốc, Người phụ trách riêng (PIC), Đợt thanh toán liên kết & Các nút thao tác */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className="text-xs font-mono font-bold bg-slate-100 text-slate-900 border-slate-300"
                      >
                        {item.code}
                      </Badge>
                      <Badge variant="outline" className={statusInfo.className}>
                        {statusInfo.label}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        <IconUserCheck className="size-3.5" />
                        Phụ trách bàn giao: {item.ownerPic || selectedContract.pmOwner}
                      </span>
                      {m4.isOverLimit && (
                        <Badge className="bg-red-600 text-white border-0 text-xs animate-pulse">
                          BÁO ĐỘNG ĐỎ: ÂM QUỸ ({m4.balanceVsLimitMandays} MD so với Limit)
                        </Badge>
                      )}
                      {m4.isFinished && m4.surplusMandays >= 0 && (
                        <Badge className="bg-emerald-600 text-white border-0 text-xs">
                          Đã Finish • Dôi dư +{m4.surplusMandays} MD
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-foreground">
                      {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Hạn bàn giao mốc:{" "}
                        <strong className="text-foreground">
                          {item.dueDate || selectedContract.expectedEndDate}
                        </strong>
                      </span>
                      {item.lastCheckDate && (
                        <span>
                          Check Mandays gần nhất:{" "}
                          <strong className="text-foreground">
                            {item.lastCheckDate}
                          </strong>
                        </span>
                      )}
                      {linkedInstallments.length > 0 && (
                        <span className="text-emerald-800 font-medium">
                          Liên kết Đợt TT:{" "}
                          {linkedInstallments.map((i) => i.name).join(", ")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Cụm nút hành động chuẩn Concept Credit In/Out */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant={isHistoryOpen ? "secondary" : "outline"}
                      className="h-8 text-xs gap-1"
                      onClick={() => toggleStoneHistory(item.id)}
                    >
                      <IconHistory className="size-3.5" />
                      Audit Log ({stoneLogs.length})
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                      onClick={() =>
                        handleOpenCreateCrForMilestone(item, "FREE_SUPPORT")
                      }
                    >
                      <IconPlus className="size-3.5" />
                      Phát sinh / Hỗ trợ 0đ
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1.5 font-semibold border-primary/40 text-primary hover:bg-primary/5"
                      onClick={() => handleOpenLogMandaysModal(item)}
                    >
                      <IconPlus className="size-3.5" />
                      Log Mandays (Định kỳ)
                    </Button>

                    {!m4.isFinished && (
                      <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        onClick={() => handleOpenFinishMilestoneModal(item)}
                      >
                        <IconFlagCheck className="size-3.5" />
                        Finish Milestone
                      </Button>
                    )}
                  </div>
                </div>

                {/* Hàng 2: BẢNG 4 CHỈ SỐ TÀI CHÍNH CỦA MỐC (LIMIT / TARGET / ESTIMATE / REAL) + SỐ DƯ IN/OUT */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 rounded-lg border bg-slate-50/80 p-3 text-xs">
                  <div className="rounded border bg-white p-2.5">
                    <span className="text-[11px] text-muted-foreground block">
                      1. Limit (Công ty cấp)
                    </span>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {roleView === "PM" ? "Đã ẩn" : `${m4.limitMandays} MD`}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {roleView === "PM"
                        ? "Bảo mật nội bộ"
                        : formatMoney(m4.limitValueVnd)}
                    </span>
                  </div>

                  <div className="rounded border border-primary/25 bg-white p-2.5">
                    <span className="text-[11px] text-primary font-medium block">
                      2. Target (AM ép tiến độ)
                    </span>
                    <div className="text-base font-bold text-primary mt-0.5">
                      {m4.targetMandays} MD
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {roleView === "PM"
                        ? "Mục tiêu giao PM"
                        : formatMoney(m4.targetValueVnd)}
                    </span>
                  </div>

                  <div className="rounded border bg-white p-2.5">
                    <span className="text-[11px] text-muted-foreground block">
                      3. Estimate (PM dự toán)
                    </span>
                    <div className="text-base font-bold text-foreground mt-0.5">
                      {m4.estimateMandays} MD
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Gồm {item.handoverEstimatedMandays ?? 1} MD bàn giao
                    </span>
                  </div>

                  <div className="rounded border bg-white p-2.5">
                    <span className="text-[11px] text-muted-foreground block">
                      4. Real (Thực tế đã dùng)
                    </span>
                    <div
                      className={
                        m4.isOverLimit
                          ? "text-base font-bold text-red-600 mt-0.5"
                          : m4.isOverTarget
                          ? "text-base font-bold text-amber-600 mt-0.5"
                          : "text-base font-bold text-emerald-700 mt-0.5"
                      }
                    >
                      {m4.realMandays} MD
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {roleView === "PM"
                        ? `Còn ${m4.balanceVsTargetMandays} MD vs Target`
                        : formatMoney(m4.realValueVnd)}
                    </span>
                  </div>

                  <div
                    className={`rounded border p-2.5 col-span-2 sm:col-span-1 ${
                      m4.isOverLimit
                        ? "bg-red-50 border-red-300"
                        : "bg-emerald-50/70 border-emerald-200"
                    }`}
                  >
                    <span className="text-[11px] font-medium block text-foreground">
                      {m4.isFinished
                        ? "Chốt Dôi dư (50/50)"
                        : "Số dư Credit (Limit − Real)"}
                    </span>
                    <div
                      className={
                        m4.isOverLimit
                          ? "text-base font-bold text-red-600 mt-0.5"
                          : "text-base font-bold text-emerald-700 mt-0.5"
                      }
                    >
                      {roleView === "PM"
                        ? `${m4.balanceVsTargetMandays >= 0 ? `+${m4.balanceVsTargetMandays}` : m4.balanceVsTargetMandays} MD`
                        : `${m4.balanceVsLimitMandays >= 0 ? `+${m4.balanceVsLimitMandays}` : m4.balanceVsLimitMandays} MD`}
                    </div>
                    {roleView !== "PM" && (
                      <span className="text-[10px] text-muted-foreground block">
                        {m4.surplusValueVnd >= 0
                          ? `50% Rủi ro: ${formatMoney(m4.riskBuffer50Vnd)} | 50% Thưởng: ${formatMoney(m4.teamBonus50Vnd)}`
                          : `Âm quỹ: -${formatMoney(Math.abs(m4.surplusValueVnd))}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Thanh trực quan mức tiêu hao Mandays so với Limit */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      Mức tiêu hao Tài khoản Tín dụng của {item.code}:{" "}
                      <strong className="text-foreground">
                        Đã dùng {m4.realMandays} MD
                      </strong>{" "}
                      {roleView !== "PM"
                        ? `/ Limit ${m4.limitMandays} MD (Target AM: ${m4.targetMandays} MD)`
                        : `/ Target ${m4.targetMandays} MD`}
                    </span>
                    <span
                      className={
                        m4.isOverLimit
                          ? "font-bold text-red-600"
                          : "font-medium text-foreground"
                      }
                    >
                      {m4.isOverLimit
                        ? "VƯỢT LIMIT — BÁO ĐỘNG ĐỎ!"
                        : `${burnRatio}% hạn mức`}
                    </span>
                  </div>
                  <Progress
                    value={burnRatio}
                    indicatorClassName={
                      m4.isOverLimit
                        ? "bg-red-600"
                        : m4.isOverTarget
                        ? "bg-amber-500"
                        : "bg-emerald-600"
                    }
                    className="h-2"
                  />
                </div>

                {item.pmNote && (
                  <p className="text-xs text-muted-foreground">
                    Ghi chú Mốc: <span className="text-foreground">{item.pmNote}</span>
                  </p>
                )}

                {item.blockerNote && (
                  <p className="text-xs text-red-600 font-medium pt-1 border-t">
                    Điểm nghẽn tại Mốc này: {item.blockerNote}
                  </p>
                )}

                {/* MỤC 5 BIÊN BẢN HỌP: YÊU CẦU PHÁT SINH (UPSELL & HỖ TRỢ 0 ĐỒNG) TÍCH HỢP THẲNG TRONG MỐC */}
                {milestoneCrs.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/25 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span>
                        Yêu cầu phát sinh & Hỗ trợ 0 đồng phát sinh ngay trong {item.code} ({milestoneCrs.length} mục):
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenCreateCrForMilestone(item, "UPSELL")
                        }
                        className="text-primary hover:underline text-[11px]"
                      >
                        + Thêm phát sinh tại mốc này
                      </button>
                    </div>

                    <div className="space-y-2">
                      {milestoneCrs.map((cr) => {
                        const st = CR_STATUS_BADGE[cr.status]
                        const isFree =
                          cr.crType === "FREE_SUPPORT" ||
                          cr.status === "APPROVED_FREE_GOODWILL"
                        const isPending =
                          cr.status === "AM_QUOTING" ||
                          cr.status === "PM_ESTIMATING"

                        return (
                          <div
                            key={cr.id}
                            className="rounded border bg-white p-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                          >
                            <div className="space-y-0.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={
                                    isFree
                                      ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                                      : "bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                                  }
                                >
                                  {isFree
                                    ? "Phát sinh Hỗ trợ (0 đồng)"
                                    : "Phát sinh Có tính tiền (Upsell)"}
                                </Badge>
                                <span className="font-mono text-[11px] text-muted-foreground">
                                  {cr.code} • {cr.requestedDate}
                                </span>
                                <Badge variant="outline" className={`text-[10px] ${st.className}`}>
                                  {st.label}
                                </Badge>
                              </div>
                              <div className="font-medium text-foreground">
                                {cr.title}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {isFree ? (
                                  <span>
                                    Công Dev:{" "}
                                    <strong>{cr.devMandays ?? 1} ngày</strong> → Tính cả Test & Bàn giao:{" "}
                                    <strong className="text-blue-700">
                                      +{cr.pmEstimatedMandays} MD thực tế
                                    </strong>{" "}
                                    (Đã lưu làm bằng chứng với khách)
                                  </span>
                                ) : (
                                  <span>
                                    Dự toán: <strong>+{cr.pmEstimatedMandays} MD</strong>
                                    {roleView !== "PM" && (
                                      <>
                                        {" "}
                                        • Báo giá phụ lục:{" "}
                                        <strong className="text-foreground">
                                          {formatMoney(cr.quotedPriceVnd)}
                                        </strong>
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isPending && roleView !== "PM" && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => handleOpenApproveUpsell(cr)}
                                >
                                  Duyệt Upsell (+{cr.pmEstimatedMandays} MD)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-red-600"
                                  onClick={() =>
                                    resolveChangeRequest(
                                      selectedContract.id,
                                      cr.id,
                                      "REJECTED"
                                    )
                                  }
                                >
                                  Từ chối
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Khung Audit Log (Lịch sử kiểm tra & trừ lùi Mandays) */}
                {isHistoryOpen && (
                  <div className="rounded-md border bg-slate-50/90 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span className="flex items-center gap-1.5">
                        <IconHistory className="size-4 text-primary" />
                        Audit Log — Lịch sử kiểm tra & ghi nhận Mandays tiêu hao của {item.code} ({stoneLogs.length} lần)
                      </span>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground underline text-[11px]"
                        onClick={() => toggleStoneHistory(item.id)}
                      >
                        Thu gọn
                      </button>
                    </div>

                    {stoneLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Mốc này chưa có lần Log Mandays nào.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {stoneLogs.map((log) => {
                          const delta =
                            log.deltaMandays !== undefined
                              ? log.deltaMandays
                              : log.newActualMandays - log.previousActualMandays
                          return (
                            <div
                              key={log.id}
                              className="rounded border bg-white p-2.5 text-xs space-y-1"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[11px] font-semibold text-foreground">
                                    Ngày check: {log.updatedAt}
                                  </span>
                                  <span>•</span>
                                  <span className="font-medium text-primary">
                                    {log.updatedBy}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {delta > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]"
                                    >
                                      Tiêu hao +{delta} MD
                                    </Badge>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className="bg-slate-100 text-slate-800 text-[10px]"
                                  >
                                    Lũy kế Real: {log.previousActualMandays} →{" "}
                                    {log.newActualMandays} MD
                                  </Badge>
                                </div>
                              </div>
                              {log.note && (
                                <div className="text-muted-foreground">
                                  Lý do / Công việc:{" "}
                                  <span className="text-foreground font-medium">
                                    {log.note}
                                  </span>
                                </div>
                              )}
                              {log.blockerNote && (
                                <div className="text-red-600 font-medium">
                                  Điểm nghẽn: {log.blockerNote}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* MODAL 1: LOG MANDAYS ĐỊNH KỲ (TRỪ LÙI TÀI KHOẢN TÍN DỤNG - KHÔNG NHẬP %) */}
      <Dialog
        open={!!loggingScopeItem}
        onOpenChange={(o) => !o && setLoggingScopeItem(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Log Mandays Tiêu Hao Định Kỳ ({loggingScopeItem?.code})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Định kỳ (2 ngày, 5 ngày hoặc hàng tuần), AM và PM kiểm tra và ghi nhận số Mandays thực tế đã tiêu hao để trừ lùi vào hạn mức Limit của Mốc.
            </DialogDescription>
          </DialogHeader>
          {loggingScopeItem &&
            (() => {
              const m4 = getMilestoneFourMetrics(
                loggingScopeItem,
                selectedContract
              )
              const previewNewReal =
                logMode === "ADD_DELTA"
                  ? Number((m4.realMandays + deltaMdInput).toFixed(1))
                  : cumulativeMdInput
              const previewBalance = Number(
                (m4.limitMandays - previewNewReal).toFixed(1)
              )
              const willOverLimit = previewNewReal > m4.limitMandays

              return (
                <div className="space-y-3.5 py-1 text-xs">
                  <div className="rounded-lg border bg-slate-50 p-3 space-y-1.5">
                    <div className="font-semibold text-foreground">
                      {loggingScopeItem.title}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div>
                        <span className="text-muted-foreground block">
                          Limit Cty cấp:
                        </span>
                        <strong>
                          {roleView === "PM" ? "Ẩn" : `${m4.limitMandays} MD`}
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">
                          Target AM giao:
                        </span>
                        <strong className="text-primary">
                          {m4.targetMandays} MD
                        </strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">
                          Real hiện tại:
                        </span>
                        <strong>{m4.realMandays} MD</strong>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLogMode("ADD_DELTA")}
                      className={`rounded-md border p-2 text-xs font-medium text-center ${
                        logMode === "ADD_DELTA"
                          ? "bg-primary text-white border-primary"
                          : "bg-slate-50 text-foreground"
                      }`}
                    >
                      Cộng thêm kỳ này (+MD)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLogMode("SET_CUMULATIVE")
                        setCumulativeMdInput(m4.realMandays)
                      }}
                      className={`rounded-md border p-2 text-xs font-medium text-center ${
                        logMode === "SET_CUMULATIVE"
                          ? "bg-primary text-white border-primary"
                          : "bg-slate-50 text-foreground"
                      }`}
                    >
                      Nhập tổng Real lũy kế
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {logMode === "ADD_DELTA" ? (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Số Mandays tiêu hao đợt này (+MD)
                        </Label>
                        <Input
                          type="number"
                          step={0.5}
                          min={0.5}
                          value={deltaMdInput}
                          onChange={(e) =>
                            setDeltaMdInput(Math.max(0, Number(e.target.value) || 0))
                          }
                          className="h-9 text-xs font-bold"
                        />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Tổng Mandays thực tế lũy kế (Real MD)
                        </Label>
                        <Input
                          type="number"
                          step={0.5}
                          min={0}
                          value={cumulativeMdInput}
                          onChange={(e) =>
                            setCumulativeMdInput(
                              Math.max(0, Number(e.target.value) || 0)
                            )
                          }
                          className="h-9 text-xs font-bold"
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-xs">Ngày kiểm tra (Audit Date)</Label>
                      <Input
                        type="date"
                        value={logCheckDate}
                        onChange={(e) => setLogCheckDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Khung xem trước số dư sau khi trừ lùi */}
                  <div
                    className={`rounded-lg border p-3 ${
                      willOverLimit
                        ? "border-red-400 bg-red-50 text-red-900"
                        : "border-emerald-200 bg-emerald-50/60 text-emerald-950"
                    }`}
                  >
                    <div className="flex justify-between font-semibold">
                      <span>Lũy kế Real sau khi Log:</span>
                      <span>
                        {m4.realMandays} MD → <strong>{previewNewReal} MD</strong>
                      </span>
                    </div>
                    {roleView !== "PM" && (
                      <div className="flex justify-between mt-1 text-[11px]">
                        <span>Số dư còn lại so với Limit ({m4.limitMandays} MD):</span>
                        <strong
                          className={
                            willOverLimit ? "text-red-600" : "text-emerald-700"
                          }
                        >
                          {previewBalance >= 0
                            ? `Còn dư +${previewBalance} MD`
                            : `BÁO ĐỘNG ĐỎ: ÂM QUỸ ${previewBalance} MD!`}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">
                      Lý do tiêu hao / Hạng mục đã làm trong kỳ này (*)
                    </Label>
                    <Textarea
                      rows={2}
                      value={logReasonNote}
                      onChange={(e) => setLogReasonNote(e.target.value)}
                      placeholder="VD: Hoàn thành API đồng bộ giỏ hàng và sửa 3 lỗi UAT..."
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">
                      Điểm nghẽn / Blocker (Nếu có)
                    </Label>
                    <Input
                      value={logBlockerNote}
                      onChange={(e) => setLogBlockerNote(e.target.value)}
                      placeholder="Để trống nếu không vướng mắc..."
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )
            })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLoggingScopeItem(null)}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveLogMandays}>
              <IconCheck className="size-4 mr-1" />
              Lưu Log Mandays
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: FINISH MILESTONE (CHỐT MỐC & TỰ TÍNH DÔI DƯ CHIA 50/50) */}
      <Dialog
        open={!!finishingScopeItem}
        onOpenChange={(o) => !o && setFinishingScopeItem(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Finish Milestone & Quyết Toán Số Dư ({finishingScopeItem?.code})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Khi bấm Finish Milestone, hệ thống tự động lấy Limit trừ đi Real để tính số Mandays dôi dư và phân bổ theo quy tắc 50/50.
            </DialogDescription>
          </DialogHeader>
          {finishingScopeItem &&
            (() => {
              const m4 = getMilestoneFourMetrics(
                finishingScopeItem,
                selectedContract
              )
              return (
                <div className="space-y-3 py-2 text-xs">
                  <div className="rounded-lg border bg-slate-50 p-3.5 space-y-2">
                    <div className="font-semibold text-foreground">
                      {finishingScopeItem.title}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Limit (Hạn mức công ty cấp):
                      </span>
                      <strong>
                        {roleView === "PM" ? "Đã ẩn" : `${m4.limitMandays} MD`}
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Target (Mục tiêu AM ép):
                      </span>
                      <strong className="text-primary">
                        {m4.targetMandays} MD
                      </strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Real (Thực tế đã tiêu hao):
                      </span>
                      <strong>{m4.realMandays} MD</strong>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-sm">
                      <span className="font-semibold">
                        Mandays dôi dư (Limit − Real):
                      </span>
                      <strong
                        className={
                          m4.surplusMandays >= 0
                            ? "text-emerald-700"
                            : "text-red-600"
                        }
                      >
                        {m4.surplusMandays >= 0
                          ? `+${m4.surplusMandays} MD (${formatMoney(m4.surplusValueVnd)})`
                          : `${m4.surplusMandays} MD (Âm ${formatMoney(Math.abs(m4.surplusValueVnd))})`}
                      </strong>
                    </div>
                  </div>

                  {m4.surplusMandays > 0 && roleView !== "PM" && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                        <span className="text-[11px] text-blue-900 font-medium block">
                          50% Giữ lại bù rủi ro mốc sau
                        </span>
                        <div className="text-sm font-bold text-blue-950 mt-1">
                          +{(m4.surplusMandays / 2).toFixed(1)} MD ({formatMoney(m4.riskBuffer50Vnd)})
                        </div>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                        <span className="text-[11px] text-emerald-900 font-medium block">
                          50% Chia thưởng (Lead/PM, Dev, AM)
                        </span>
                        <div className="text-sm font-bold text-emerald-700 mt-1">
                          +{(m4.surplusMandays / 2).toFixed(1)} MD ({formatMoney(m4.teamBonus50Vnd)})
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Ghi chú chốt nghiệm thu Mốc</Label>
                    <Textarea
                      rows={2}
                      value={finishSummaryNote}
                      onChange={(e) => setFinishSummaryNote(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>
              )
            })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFinishingScopeItem(null)}
            >
              Hủy
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmFinishMilestone}
            >
              <IconFlagCheck className="size-4 mr-1" />
              Xác nhận Finish Milestone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: GHI NHẬN PHÁT SINH TRONG MỐC (TÁCH RÕ UPSELL vs HỖ TRỢ 0 ĐỒNG <= 1 NGÀY CÔNG DEV) */}
      <Dialog open={crModalOpen} onOpenChange={setCrModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Ghi Nhận Phát Sinh / Hỗ Trợ Trực Tiếp Trong Mốc
            </DialogTitle>
            <DialogDescription className="text-xs">
              Phân loại rõ <strong>Phát sinh có tính tiền (Upsell)</strong> và <strong>Phát sinh hỗ trợ (0 đồng)</strong>. Quy định: Nghiêm cấm hỗ trợ việc vặt quá 1 ngày công của Dev (= 3 ngày công thực tế).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Thuộc Mốc bàn giao đang chạy</Label>
              <Select value={crMilestoneId} onValueChange={setCrMilestoneId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedContract.scopeItems.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.title} ({s.ownerPic || "PM"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chọn 1 trong 2 loại phát sinh */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setCrType("FREE_SUPPORT")
                  setCrDevMd(0.5)
                  setCrEstimatedMd(1.5)
                  setCrQuotedPrice(0)
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  crType === "FREE_SUPPORT"
                    ? "border-blue-600 bg-blue-50/70"
                    : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div className="font-semibold text-blue-950">
                  1. Phát sinh Hỗ trợ (0 đồng)
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Khách nhờ việc vặt (≤ 1 MD Dev = ≤ 3 MD thực tế). Log lại làm bằng chứng.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCrType("UPSELL")
                  setCrDevMd(5)
                  setCrEstimatedMd(10)
                  setCrQuotedPrice(35_000_000)
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  crType === "UPSELL"
                    ? "border-emerald-600 bg-emerald-50/70"
                    : "bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div className="font-semibold text-emerald-950">
                  2. Phát sinh Có tính tiền (Upsell)
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Tính năng lớn → Báo giá, ký phụ lục, cộng thêm Limit & Target MD.
                </div>
              </button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tên yêu cầu phát sinh / việc khách nhờ</Label>
              <Input
                value={crTitle}
                onChange={(e) => setCrTitle(e.target.value)}
                placeholder={
                  crType === "FREE_SUPPORT"
                    ? "VD: Chỉnh lại mẫu phiếu in PDF theo logo mới của khách..."
                    : "VD: Tích hợp cổng thanh toán tự động VietQR..."
                }
              />
            </div>

            {crType === "FREE_SUPPORT" ? (
              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Số ngày công của Dev (Tối đa 1.0 MD)
                    </Label>
                    <Input
                      type="number"
                      step={0.25}
                      min={0.25}
                      value={crDevMd}
                      onChange={(e) => {
                        const devVal = Number(e.target.value) || 0
                        setCrDevMd(devVal)
                        setCrEstimatedMd(Number((devVal * 3).toFixed(2)))
                      }}
                      className="h-9 text-xs font-bold bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">
                      Tổng MD thực tế (×3 gồm Test & Bàn giao)
                    </Label>
                    <Input
                      type="number"
                      step={0.5}
                      value={crEstimatedMd}
                      onChange={(e) =>
                        setCrEstimatedMd(Number(e.target.value) || 0)
                      }
                      className="h-9 text-xs font-bold bg-white text-blue-700"
                    />
                  </div>
                </div>

                {crDevMd > 1 ? (
                  <div className="rounded border border-red-400 bg-red-50 p-2.5 text-red-700 font-semibold flex items-start gap-2">
                    <IconAlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>
                      VI PHẠM QUY ĐỊNH: Nghiêm cấm hỗ trợ việc vặt quá 1 ngày công của Dev (vì 1 ngày Dev = 3 ngày công thực tế)! Vui lòng chọn sang tab &quot;2. Phát sinh Có tính tiền (Upsell)&quot; để báo giá khách.
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-blue-900">
                    ✓ Hợp lệ ({crDevMd} MD Dev → {crEstimatedMd} MD thực tế). Hệ thống sẽ tự động cộng{" "}
                    <strong>+{crEstimatedMd} MD</strong> vào <strong>Real</strong> của Mốc và lưu vào Sổ bằng chứng hỗ trợ khách hàng cho AM Thảo.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs">Tổng MD Estimate (+MD)</Label>
                  <Input
                    type="number"
                    value={crEstimatedMd}
                    onChange={(e) =>
                      setCrEstimatedMd(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Giá báo khách (VNĐ)</Label>
                  <Input
                    type="number"
                    step={5_000_000}
                    value={crQuotedPrice}
                    onChange={(e) =>
                      setCrQuotedPrice(Number(e.target.value) || 0)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Giãn lịch (+Ngày)</Label>
                  <Input
                    type="number"
                    value={crTimelineDays}
                    onChange={(e) =>
                      setCrTimelineDays(Number(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Người yêu cầu phía khách</Label>
                <Input
                  value={crRequestedBy}
                  onChange={(e) => setCrRequestedBy(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              {crType === "UPSELL" && (
                <div className="space-y-1">
                  <Label className="text-xs">Loại thuế VAT</Label>
                  <Select
                    value={crVatCat}
                    onValueChange={(v) => setCrVatCat(v as VatCategory)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NON_VAT">Không chịu VAT</SelectItem>
                      <SelectItem value="VAT_8">VAT 8%</SelectItem>
                      <SelectItem value="VAT_10">VAT 10%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCrModalOpen(false)}>
              Hủy
            </Button>
            <Button
              disabled={crType === "FREE_SUPPORT" && crDevMd > 1}
              onClick={handleCreateCrSubmit}
            >
              {crType === "FREE_SUPPORT"
                ? `Log Hỗ trợ 0đ (+${crEstimatedMd} MD) & Lưu bằng chứng`
                : "Lưu & Gửi báo giá Upsell"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: XÁC NHẬN DUYỆT UPSELL */}
      <Dialog
        open={!!approvingCr}
        onOpenChange={(o) => !o && setApprovingCr(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác Nhận Khách Hàng Duyệt Phụ Lục Upsell</DialogTitle>
            <DialogDescription className="text-xs">
              Cộng +{approvingCr?.pmEstimatedMandays} MD trực tiếp vào Limit của Mốc đang chạy và phân bổ Target MD cho PM.
            </DialogDescription>
          </DialogHeader>
          {approvingCr && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-md bg-slate-50 border p-3 space-y-1">
                <div className="font-semibold text-foreground">
                  {approvingCr.title}
                </div>
                <div className="text-muted-foreground">
                  Cộng vào Limit của Mốc:{" "}
                  <strong>+{approvingCr.pmEstimatedMandays} MD</strong>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Giá trị Phụ lục Upsell chốt ký (VNĐ)
                </Label>
                <Input
                  type="number"
                  step={5_000_000}
                  value={approvedPriceDraft}
                  onChange={(e) =>
                    setApprovedPriceDraft(Number(e.target.value) || 0)
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Số Mandays cộng vào Mốc ép Target giao PM (Tối đa +
                  {approvingCr.pmEstimatedMandays} MD)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={approvingCr.pmEstimatedMandays}
                  value={allocatedToPmDraft}
                  onChange={(e) =>
                    setAllocatedToPmDraft(
                      Math.min(
                        approvingCr.pmEstimatedMandays,
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    )
                  }
                />
              </div>

              <div className="rounded-md border bg-slate-50/70 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={autoCreateInstallmentDraft}
                    onCheckedChange={(v) =>
                      setAutoCreateInstallmentDraft(Boolean(v))
                    }
                  />
                  <span className="font-medium text-foreground">
                    Tự động thêm Đợt thanh toán Phụ lục Upsell vào Lộ trình thu tiền
                  </span>
                </label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovingCr(null)}>
              Hủy
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirmApproveUpsell}
            >
              Xác nhận Duyệt Upsell
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
