"use client"

import * as React from "react"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCalendarStats,
  IconCheck,
  IconChecklist,
  IconPlus,
  IconReceipt2,
  IconTag,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
import { useQueryClient } from "@tanstack/react-query"
import { Textarea } from "@/components/ui/textarea"
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider"
import { usePatchApiV1ContractsId } from "@/lib/api/generated/contracts/contracts"
import { usePostApiV1ScopeItemsIdLogs } from "@/lib/api/generated/scope-items/scope-items"
import { isUuidString } from "@/lib/api/contract-mapper"
import {
  useWorkspaceContracts,
  useWorkspaceRole,
} from "@/lib/hooks/use-workspace-data"
import {
  calculateContractMetrics,
  ContractProject,
} from "@/lib/mock/am-types"
import { cn } from "@/lib/utils"

type InboxCategory = "ALL" | "CHECKIN" | "PAYMENT" | "ALERT_KICKOFF"

interface AmActionItem {
  id: string
  category: Exclude<InboxCategory, "ALL">
  priority: "HIGH" | "MEDIUM"
  badgeLabel: string
  badgeClass: string
  contract: ContractProject
  title: string
  subtitle: string
  primaryActionType: "QUICK_LOG" | "OPEN_CONTRACT"
}

const SUGGESTED_TAGS = [
  "Khách khó tính",
  "Chờ sếp duyệt",
  "Nguy cơ trễ",
  "Ưu tiên VIP",
  "Khách hay đổi ý",
  "Chờ tạm ứng",
]

export function AmTaskDashboardView() {
  const queryClient = useQueryClient()
  const logMandaysMutation = usePostApiV1ScopeItemsIdLogs()
  const updateContractMutation = usePatchApiV1ContractsId()
  const { contracts, canQueryRealApi } = useWorkspaceContracts({
    includeDetails: true,
  })
  const { isPmRole } = useWorkspaceRole()
  const roleView = isPmRole ? "PM" : "AM"

  const { formatMoney, openContractDetail } = useWorkspaceUi()

  const [categoryFilter, setCategoryFilter] =
    React.useState<InboxCategory>("ALL")
  const [selectedTagFilter, setSelectedTagFilter] =
    React.useState<string>("ALL")

  // Modal Log Mandays nhanh ngay từ Inbox
  const [quickLogContract, setQuickLogContract] =
    React.useState<ContractProject | null>(null)
  const [selectedMilestoneId, setSelectedMilestoneId] =
    React.useState<string>("")
  const [spentMdDraft, setSpentMdDraft] = React.useState<number>(3)
  const [logReasonDraft, setLogReasonDraft] = React.useState<string>("")

  // Modal gắn Tag nhanh
  const [tagModalContract, setTagModalContract] =
    React.useState<ContractProject | null>(null)
  const [newTagText, setNewTagText] = React.useState<string>("")

  const allTags = React.useMemo(() => {
    const set = new Set<string>()
    contracts.forEach((c) => {
      ;(c.amCustomTags || []).forEach((t) => set.add(t))
    })
    return Array.from(set)
  }, [contracts])

  // Tổng hợp tất cả việc cần làm của AM thành 1 danh sách Inbox duy nhất, gọn gàng
  const allActionItems = React.useMemo<AmActionItem[]>(() => {
    const items: AmActionItem[] = []

    contracts.forEach((c) => {
      const m = calculateContractMetrics(c)

      // 1. Quá hạn check Manday định kỳ (3-5 ngày chưa log)
      if (m.isCheckInOverdue) {
        const runningMs =
          c.scopeItems.find((s) => s.status !== "COMPLETED" && !s.isAccepted) ||
          c.scopeItems[0]
        items.push({
          id: `checkin-${c.id}`,
          category: "CHECKIN",
          priority: m.daysSinceLastCheck >= 5 ? "HIGH" : "MEDIUM",
          badgeLabel: `Quá ${m.daysSinceLastCheck} ngày chưa Log MD`,
          badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
          contract: c,
          title: `Check tiến độ & trừ lùi Mandays (${runningMs ? `${runningMs.code}: ${runningMs.title}` : "Mốc đang chạy"})`,
          subtitle: `Chu kỳ ${c.checkCycleDays || 5} ngày/lần • Lần cuối: ${m.latestCheckDateStr} • PIC: ${runningMs?.ownerPic || c.pmOwner}`,
          primaryActionType: "QUICK_LOG",
        })
      }

      // 2. Đợt thanh toán cần đòi nợ (Quá hạn hoặc Mốc liên kết đã Finish)
      if (m.overdueAmount > 0 || m.readyToBillInstallments.length > 0) {
        const targetInst =
          m.readyToBillInstallments[0] ||
          c.installments.find((i) => i.paymentStatus === "OVERDUE") ||
          c.installments.find((i) => i.paymentStatus !== "PAID")

        const amountDisplay =
          roleView === "PM"
            ? ""
            : ` (${formatMoney(targetInst?.amount || m.actionableDebtAmount)})`

        items.push({
          id: `payment-${c.id}`,
          category: "PAYMENT",
          priority: m.overdueAmount > 0 ? "HIGH" : "MEDIUM",
          badgeLabel:
            m.readyToBillInstallments.length > 0
              ? "Mốc đã xong • Đòi tiền"
              : "Quá hạn thanh toán",
          badgeClass:
            m.overdueAmount > 0
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-800 border-emerald-300",
          contract: c,
          title: `Đòi tiền ${targetInst?.name || "đợt hợp đồng"}${amountDisplay}`,
          subtitle:
            m.readyToBillInstallments.length > 0
              ? `Mốc bàn giao liên kết đã Finish → Cần gửi Đề nghị thanh toán & xuất VAT`
              : `Khách hàng đang quá hạn thanh toán • Đầu mối KT: ${c.customerName}`,
          primaryActionType: "OPEN_CONTRACT",
        })
      }

      // 3. Báo động Đỏ (Âm quỹ Credit) hoặc Chờ duyệt Upsell
      const pendingCrs = c.changeRequests.filter(
        (cr) => cr.status === "AM_QUOTING" || cr.status === "PM_ESTIMATING"
      )
      if (m.healthStatus === "RED" || pendingCrs.length > 0) {
        items.push({
          id: `alert-${c.id}`,
          category: "ALERT_KICKOFF",
          priority: "HIGH",
          badgeLabel:
            m.surplusMandays < 0
              ? `Âm quỹ (${m.surplusMandays} MD)`
              : pendingCrs.length > 0
              ? `Chờ chốt ${pendingCrs.length} Upsell`
              : "Báo động Đỏ",
          badgeClass: "bg-red-50 text-red-700 border-red-200",
          contract: c,
          title:
            m.surplusMandays < 0
              ? `Cảnh báo lố Limit (${m.effectiveRealMandays}/${m.totalMaxMandays} MD) — Cần khoanh Scope hoặc báo giá Upsell`
              : pendingCrs.length > 0
              ? `Đàm phán ký phụ lục Upsell: "${pendingCrs[0].title}" (+${pendingCrs[0].pmEstimatedMandays} MD)`
              : m.healthReason,
          subtitle: `PM tổng: ${c.pmOwner} • Số dư hiện tại: ${m.surplusMandays >= 0 ? `+${m.surplusMandays}` : m.surplusMandays} MD`,
          primaryActionType: "OPEN_CONTRACT",
        })
      }

      // 4. Hợp đồng mới chưa đủ Checklist Kick-off 4 mục
      if (c.phase === "PRE_PROJECT" && !m.canKickoffToInProject) {
        items.push({
          id: `kickoff-${c.id}`,
          category: "ALERT_KICKOFF",
          priority: "MEDIUM",
          badgeLabel: `Checklist Kick-off (${m.kickoffEval.completedCount}/4)`,
          badgeClass: "bg-violet-50 text-violet-800 border-violet-200",
          contract: c,
          title: `Hoàn tất 4 điều kiện Kick-off (Drive 3 thư mục, PM xác nhận Scope, Timeline, Estimate bàn giao)`,
          subtitle: m.isFirstInstallmentPaid
            ? "Đã thu tạm ứng Đợt 1 • Chỉ còn tích đủ Checklist để Start dự án"
            : "Chưa thu tạm ứng Đợt 1 & Chưa đủ 4 mục Checklist Kick-off",
          primaryActionType: "OPEN_CONTRACT",
        })
      }
    })

    return items
  }, [contracts, roleView, formatMoney])

  const filteredItems = React.useMemo(() => {
    return allActionItems.filter((item) => {
      if (categoryFilter !== "ALL" && item.category !== categoryFilter) {
        return false
      }
      if (
        selectedTagFilter !== "ALL" &&
        !(item.contract.amCustomTags || []).includes(selectedTagFilter)
      ) {
        return false
      }
      return true
    })
  }, [allActionItems, categoryFilter, selectedTagFilter])

  const counts = React.useMemo(() => {
    return {
      ALL: allActionItems.length,
      CHECKIN: allActionItems.filter((i) => i.category === "CHECKIN").length,
      PAYMENT: allActionItems.filter((i) => i.category === "PAYMENT").length,
      ALERT_KICKOFF: allActionItems.filter(
        (i) => i.category === "ALERT_KICKOFF"
      ).length,
    }
  }, [allActionItems])

  const handleOpenQuickLog = (c: ContractProject) => {
    const runningMilestone =
      c.scopeItems.find((s) => s.status !== "COMPLETED" && !s.isAccepted) ||
      c.scopeItems[0]
    setQuickLogContract(c)
    setSelectedMilestoneId(runningMilestone?.id || "")
    setSpentMdDraft(3)
    setLogReasonDraft("")
  }

  const handleConfirmQuickLog = async () => {
    if (!quickLogContract || !selectedMilestoneId) return
    if (!logReasonDraft.trim()) {
      toast.error("Vui lòng nhập ngắn gọn hạng mục đã làm trong kỳ")
      return
    }
    if (!canQueryRealApi || !isUuidString(selectedMilestoneId)) {
      toast.error("Không tìm thấy mã Mốc bàn giao hợp lệ")
      return
    }
    try {
      await logMandaysMutation.mutateAsync({
        id: selectedMilestoneId,
        data: {
          delta_mandays: spentMdDraft,
          note: logReasonDraft.trim(),
          check_date: new Date().toISOString().slice(0, 10),
        },
      })
      queryClient.invalidateQueries({ queryKey: ["/api/v1/contracts"] })
      queryClient.invalidateQueries({
        queryKey: [`/api/v1/contracts/${quickLogContract.id}`],
      })
      toast.success(`Đã ghi nhận +${spentMdDraft} MD vào cơ sở dữ liệu!`)
      setQuickLogContract(null)
    } catch {
      toast.error("Không thể cập nhật ngày công lên máy chủ")
    }
  }

  const handleAddTag = async (tag: string) => {
    if (!tagModalContract || !tag.trim()) return
    const nextTags = Array.from(
      new Set([...(tagModalContract.amCustomTags || []), tag.trim()])
    )
    try {
      await updateContractMutation.mutateAsync({
        id: tagModalContract.id,
        data: { am_custom_tags: nextTags },
      })
      queryClient.invalidateQueries({ queryKey: ["/api/v1/contracts"] })
      queryClient.invalidateQueries({
        queryKey: [`/api/v1/contracts/${tagModalContract.id}`],
      })
      toast.success(`Đã gắn nhãn [${tag.trim()}]`)
    } catch {
      toast.error("Không thể lưu nhãn hợp đồng")
    }
    setNewTagText("")
  }

  const handleRemoveTag = async (contractId: string, tag: string) => {
    const target = contracts.find((c) => c.id === contractId)
    if (!target) return
    const nextTags = (target.amCustomTags || []).filter((t) => t !== tag)
    try {
      await updateContractMutation.mutateAsync({
        id: contractId,
        data: { am_custom_tags: nextTags },
      })
      queryClient.invalidateQueries({ queryKey: ["/api/v1/contracts"] })
      queryClient.invalidateQueries({
        queryKey: [`/api/v1/contracts/${contractId}`],
      })
      toast.success(`Đã gỡ nhãn [${tag}]`)
    } catch {
      toast.error("Không thể gỡ nhãn hợp đồng")
    }
  }

  return (
    <div className="space-y-5">
      {/* Header gọn gàng */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Việc Cần Làm Của AM Hôm Nay (AM Action Inbox)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tự động tổng hợp các dự án đến kỳ check Manday, đợt thanh toán cần đòi nợ và cảnh báo vượt Limit
          </p>
        </div>

        {/* Bộ lọc theo Tag lưu ý */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
              <IconTag className="size-3.5" />
              Lọc Tag:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTagFilter("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                selectedTagFilter === "ALL"
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-muted-foreground hover:text-foreground"
              )}
            >
              Tất cả
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  setSelectedTagFilter(selectedTagFilter === tag ? "ALL" : tag)
                }
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                  selectedTagFilter === tag
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100"
                )}
              >
                [{tag}]
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4 Nút Tab Lọc Nhanh (Thay cho 4 hộp rối mắt cũ) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            id: "ALL" as InboxCategory,
            label: "Tất cả việc cần xử lý",
            count: counts.ALL,
            icon: IconChecklist,
            activeClass: "border-primary bg-primary/5",
            numClass: "text-foreground",
          },
          {
            id: "CHECKIN" as InboxCategory,
            label: "Cần Log Manday định kỳ",
            count: counts.CHECKIN,
            icon: IconCalendarStats,
            activeClass: "border-amber-400 bg-amber-50/50",
            numClass: "text-amber-600",
          },
          {
            id: "PAYMENT" as InboxCategory,
            label: "Cần đòi tiền / Xuất VAT",
            count: counts.PAYMENT,
            icon: IconReceipt2,
            activeClass: "border-emerald-400 bg-emerald-50/50",
            numClass: "text-emerald-700",
          },
          {
            id: "ALERT_KICKOFF" as InboxCategory,
            label: "Báo động Đỏ & Kick-off",
            count: counts.ALERT_KICKOFF,
            icon: IconAlertTriangle,
            activeClass: "border-red-400 bg-red-50/50",
            numClass: "text-red-600",
          },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = categoryFilter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={cn(
                "rounded-xl border p-3.5 text-left transition-all bg-card hover:border-slate-300 flex items-center justify-between",
                isActive && tab.activeClass
              )}
            >
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {tab.label}
                </div>
                <div className={cn("text-2xl font-bold mt-1", tab.numClass)}>
                  {tab.count}
                </div>
              </div>
              <div className="size-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Icon className="size-5" />
              </div>
            </button>
          )
        })}
      </div>

      {/* DANH SÁCH 1 BẢNG INBOX DUY NHẤT, SẠCH VÀ DỄ QUÉT MẮT */}
      <Card className="shadow-none border bg-card overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="mx-auto size-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <IconCheck className="size-5" />
            </div>
            <div className="text-sm font-semibold text-foreground">
              Tuyệt vời! Không còn việc tồn đọng nào trong mục này.
            </div>
            <p className="text-xs text-muted-foreground">
              Mọi hợp đồng đều đã được cập nhật Mandays và đối soát dòng tiền đúng hạn.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {filteredItems.map((item) => {
              const { contract } = item
              const m = calculateContractMetrics(contract)

              return (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Cột trái: Nhãn việc + Tên dự án + Tags + Mô tả ngắn */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-semibold", item.badgeClass)}
                      >
                        {item.badgeLabel}
                      </Badge>

                      <span className="font-mono text-xs font-semibold text-primary">
                        {contract.contractCode}
                      </span>

                      <button
                        type="button"
                        onClick={() => openContractDetail(contract.id)}
                        className="text-sm font-semibold text-foreground hover:text-primary truncate"
                      >
                        {contract.projectName}
                      </button>

                      {/* Tags của hợp đồng */}
                      {(contract.amCustomTags || []).map((t) => (
                        <Badge
                          key={t}
                          variant="outline"
                          className="text-[10px] bg-amber-50/90 text-amber-900 border-amber-300 gap-1 pr-0.5 py-0.5"
                        >
                          <span>[{t}]</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(contract.id, t)}
                            aria-label={`Xóa nhãn ${t}`}
                            className="inline-flex size-5 items-center justify-center hover:bg-amber-200 rounded transition-colors"
                          >
                            <IconX className="size-3" />
                          </button>
                        </Badge>
                      ))}
                      <button
                        type="button"
                        onClick={() => setTagModalContract(contract)}
                        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 px-1.5 py-1 rounded hover:bg-slate-100"
                      >
                        <IconTag className="size-3" />
                        <span>+Tag</span>
                      </button>
                    </div>

                    <div className="text-xs font-medium text-foreground">
                      → {item.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.subtitle}
                    </div>
                  </div>

                  {/* Cột phải: Chỉ số Credit ngắn gọn + Nút hành động 1 chạm */}
                  <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 border-t lg:border-t-0 pt-2.5 lg:pt-0">
                    <div className="text-left lg:text-right font-mono text-xs">
                      <div className="text-[11px] text-muted-foreground font-sans">
                        Real / Target / Limit
                      </div>
                      <div>
                        <strong
                          className={
                            m.isOverLimit ? "text-red-600" : "text-foreground"
                          }
                        >
                          {m.effectiveRealMandays}
                        </strong>{" "}
                        / <span className="text-blue-700">{m.effectiveTargetMandays}</span> /{" "}
                        <span>
                          {roleView === "PM" ? "Ẩn" : `${m.totalMaxMandays} MD`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.primaryActionType === "QUICK_LOG" && (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={() => handleOpenQuickLog(contract)}
                        >
                          <IconPlus className="size-3.5" />
                          Log Manday ngay
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant={
                          item.primaryActionType === "QUICK_LOG"
                            ? "outline"
                            : "default"
                        }
                        className="h-8 text-xs gap-1"
                        onClick={() => openContractDetail(contract.id)}
                      >
                        <span>Mở Hợp đồng</span>
                        <IconArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Modal Log Mandays nhanh từ Inbox */}
      <Dialog
        open={!!quickLogContract}
        onOpenChange={(o) => !o && setQuickLogContract(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Log Mandays Định Kỳ (Trừ Lùi Hạn Mức)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Dự án: <strong>{quickLogContract?.projectName}</strong>
            </DialogDescription>
          </DialogHeader>
          {quickLogContract && (
            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label className="text-xs">Chọn Mốc bàn giao đang chạy</Label>
                <Select
                  value={selectedMilestoneId}
                  onValueChange={setSelectedMilestoneId}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {quickLogContract.scopeItems.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        [{s.code}] {s.title} (Đã dùng {s.actualMandays ?? 0}/
                        {s.limitMandays ?? s.estimatedMandays} MD)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Số Mandays tiêu hao trong kỳ này
                </Label>
                <Input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={spentMdDraft}
                  onChange={(e) =>
                    setSpentMdDraft(Math.max(0.5, Number(e.target.value) || 0))
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Lý do / Hạng mục đã thực hiện (Audit Log)
                </Label>
                <Textarea
                  rows={2}
                  value={logReasonDraft}
                  onChange={(e) => setLogReasonDraft(e.target.value)}
                  placeholder="VD: Hoàn thiện luồng phân quyền và bàn giao bản test..."
                  className="text-xs"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuickLogContract(null)}
            >
              Hủy
            </Button>
            <Button onClick={handleConfirmQuickLog}>Lưu vào Sổ cái Credit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gắn Tag */}
      <Dialog
        open={!!tagModalContract}
        onOpenChange={(o) => !o && setTagModalContract(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Gắn Nhãn Lưu Ý Cho Hợp Đồng
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    handleAddTag(s)
                    setTagModalContract(null)
                  }}
                  className="rounded-md border bg-slate-50 hover:bg-amber-50 hover:border-amber-300 px-2.5 py-1 text-xs"
                >
                  + [{s}]
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTagText}
                onChange={(e) => setNewTagText(e.target.value)}
                placeholder="Nhập nhãn riêng..."
                className="h-9 text-xs"
              />
              <Button
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  handleAddTag(newTagText)
                  setTagModalContract(null)
                }}
              >
                Gắn nhãn
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
