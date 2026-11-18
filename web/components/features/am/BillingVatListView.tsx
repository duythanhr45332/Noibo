"use client"

import * as React from "react"
import {
  IconCheck,
  IconCopy,
  IconFileText,
  IconPlus,
  IconSearch,
  IconUpload,
} from "@tabler/icons-react"
import { toast } from "sonner"
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
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import { PersonAvatar } from "@/components/features/am/ProductiveHomeDashboard"
import {
  calculateContractMetrics,
  ContractProject,
  getMilestoneFourMetrics,
  PaymentInstallment,
  ScopeItem,
} from "@/lib/mock/am-types"
import { cn } from "@/lib/utils"

interface FlattenedInstallmentRow {
  contract: ContractProject
  installment: PaymentInstallment
  linkedMilestonesLabel: string
  allLinkedMilestonesFinished: boolean
}

interface FlattenedBonusRow {
  contract: ContractProject
  scopeItem: ScopeItem
  four: ReturnType<typeof getMilestoneFourMetrics>
}

export function BillingVatListView() {
  const {
    contracts,
    customers,
    roleView,
    formatMoney,
    openContractDetail,
    updateInstallment,
    addInstallment,
  } = useAmPrototype()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [projectFilter, setProjectFilter] = React.useState<string>("ALL")
  const [paymentFilter, setPaymentFilter] = React.useState<string>("ALL")
  const [vatFilter, setVatFilter] = React.useState<string>("ALL")

  // Modal Xuất Hóa đơn VAT
  const vatFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [issuingRow, setIssuingRow] =
    React.useState<FlattenedInstallmentRow | null>(null)
  const [vatNumberDraft, setVatNumberDraft] = React.useState("")
  const [vatUrlDraft, setVatUrlDraft] = React.useState("")

  // Modal Phiếu Giao Việc Kế Toán Ngoài (1-Click Copy Brief)
  const [briefRow, setBriefRow] =
    React.useState<FlattenedInstallmentRow | null>(null)

  // Modal + Thêm Đợt thanh toán (Hỗ trợ gộp N-1 Mốc: M1 + M2 -> Đợt 1)
  const [addTrancheOpen, setAddTrancheOpen] = React.useState(false)
  const [trancheContractId, setTrancheContractId] = React.useState(
    contracts[0]?.id || ""
  )
  const [trancheName, setTrancheName] = React.useState("")
  const [tranchePct, setTranchePct] = React.useState("30")
  const [trancheAmount, setTrancheAmount] = React.useState("90000000")
  const [trancheDueDate, setTrancheDueDate] = React.useState("2026-12-20")
  const [selectedMilestoneIds, setSelectedMilestoneIds] = React.useState<
    string[]
  >([])

  const allInstallmentRows = React.useMemo<FlattenedInstallmentRow[]>(() => {
    const list: FlattenedInstallmentRow[] = []
    contracts.forEach((c) => {
      c.installments.forEach((inst) => {
        const ids =
          inst.linkedMilestoneIds && inst.linkedMilestoneIds.length > 0
            ? inst.linkedMilestoneIds
            : inst.linkedMilestoneId
            ? [inst.linkedMilestoneId]
            : []

        const linkedScopes = c.scopeItems.filter((s) => ids.includes(s.id))
        const codes = linkedScopes.map((s, idx) => s.code || `M${idx + 1}`)
        const linkedMilestonesLabel =
          codes.length > 1
            ? `Gộp ${codes.join(" + ")} (${inst.triggerMilestoneName})`
            : codes.length === 1
            ? `${codes[0]} — ${inst.triggerMilestoneName}`
            : inst.triggerMilestoneName

        const allLinkedMilestonesFinished =
          linkedScopes.length > 0 &&
          linkedScopes.every(
            (s) => s.isAccepted || s.status === "COMPLETED"
          )

        list.push({
          contract: c,
          installment: inst,
          linkedMilestonesLabel,
          allLinkedMilestonesFinished,
        })
      })
    })
    return list
  }, [contracts])

  const filteredInstallmentRows = React.useMemo(() => {
    return allInstallmentRows.filter((row) => {
      const { contract, installment } = row
      if (projectFilter !== "ALL" && contract.id !== projectFilter) return false
      if (
        paymentFilter !== "ALL" &&
        installment.paymentStatus !== paymentFilter
      )
        return false

      const hasFullVat =
        installment.vatInvoiceStatus === "ISSUED" &&
        Boolean(installment.vatInvoiceNumber?.trim())
      if (vatFilter === "ISSUED" && !hasFullVat) return false
      if (vatFilter === "MISSING" && hasFullVat) return false

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase()
        return (
          installment.name.toLowerCase().includes(q) ||
          contract.projectName.toLowerCase().includes(q) ||
          contract.contractCode.toLowerCase().includes(q) ||
          contract.customerName.toLowerCase().includes(q) ||
          row.linkedMilestonesLabel.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allInstallmentRows, projectFilter, paymentFilter, vatFilter, searchQuery])

  const bonusRows = React.useMemo<FlattenedBonusRow[]>(() => {
    const list: FlattenedBonusRow[] = []
    contracts.forEach((c) => {
      if (projectFilter !== "ALL" && c.id !== projectFilter) return
      c.scopeItems.forEach((item) => {
        const four = getMilestoneFourMetrics(item, c)
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase()
          const match =
            c.projectName.toLowerCase().includes(q) ||
            c.contractCode.toLowerCase().includes(q) ||
            item.title.toLowerCase().includes(q) ||
            (item.code || "").toLowerCase().includes(q) ||
            (item.ownerPic || c.pmOwner).toLowerCase().includes(q)
          if (!match) return
        }
        list.push({
          contract: c,
          scopeItem: item,
          four,
        })
      })
    })
    return list
  }, [contracts, projectFilter, searchQuery])

  // Summary cho Bảng 1 (Payment Tranches & VAT)
  const trancheSummary = React.useMemo(() => {
    let totalAmount = 0
    let paidAmount = 0
    let actionableDebtAmount = 0
    let issuedVatCount = 0

    filteredInstallmentRows.forEach(({ installment, allLinkedMilestonesFinished }) => {
      totalAmount += installment.amount
      if (installment.paymentStatus === "PAID") {
        paidAmount += installment.amount
      } else if (
        installment.paymentStatus === "INVOICED" ||
        installment.paymentStatus === "OVERDUE" ||
        allLinkedMilestonesFinished
      ) {
        actionableDebtAmount += installment.amount
      }
      if (installment.vatInvoiceStatus === "ISSUED") {
        issuedVatCount++
      }
    })

    return {
      totalAmount,
      paidAmount,
      actionableDebtAmount,
      issuedVatCount,
    }
  }, [filteredInstallmentRows])

  // Summary cho Bảng 2 (50/50 Rolling Bonus & Risk Pool)
  const bonusSummary = React.useMemo(() => {
    let totalLimitMd = 0
    let totalRealMd = 0
    let totalRiskReserveMd = 0
    let totalRiskReserveVnd = 0
    let totalUnlockedBonusVnd = 0
    let totalPendingBonusVnd = 0

    bonusRows.forEach(({ four }) => {
      totalLimitMd += four.limitMandays
      totalRealMd += four.realMandays
      totalRiskReserveMd += four.riskReserve50Md
      totalRiskReserveVnd += four.riskBuffer50Vnd
      if (four.bonusUnlockStatus === "UNLOCKED") {
        totalUnlockedBonusVnd += four.teamBonus50Vnd
      } else if (four.bonusUnlockStatus === "PENDING_PAYMENT") {
        totalPendingBonusVnd += four.teamBonus50Vnd
      }
    })

    return {
      totalLimitMd,
      totalRealMd,
      totalRiskReserveMd: Number(totalRiskReserveMd.toFixed(1)),
      totalRiskReserveVnd,
      totalUnlockedBonusVnd,
      totalPendingBonusVnd,
    }
  }, [bonusRows])

  const handleOpenVatModal = (row: FlattenedInstallmentRow) => {
    const num = row.installment.vatInvoiceNumber || "0001688"
    setIssuingRow(row)
    setVatNumberDraft(num)
    setVatUrlDraft(
      row.installment.vatInvoiceFileUrl || `Hoa-don-VAT-${num}.pdf`
    )
  }

  const handleConfirmVatModal = () => {
    if (!issuingRow) return
    if (!vatNumberDraft.trim() || !vatUrlDraft.trim()) {
      toast.error("Bắt buộc nhập Số hóa đơn VAT và File PDF!")
      return
    }
    updateInstallment(issuingRow.contract.id, issuingRow.installment.id, {
      vatInvoiceStatus: "ISSUED",
      vatInvoiceNumber: vatNumberDraft.trim(),
      vatInvoiceFileUrl: vatUrlDraft.trim(),
    })
    setIssuingRow(null)
  }

  const handleCreateInstallment = () => {
    const targetContract = contracts.find((c) => c.id === trancheContractId)
    if (!targetContract) return
    if (!trancheName.trim()) {
      toast.error("Vui lòng nhập tên Đợt thanh toán")
      return
    }
    const amt = Math.max(0, Number(trancheAmount) || 0)
    const pct = Math.max(1, Number(tranchePct) || 30)
    const vatAmt = Math.round((amt / 1.1) * 0.1)

    const linkedScopes = targetContract.scopeItems.filter((s) =>
      selectedMilestoneIds.includes(s.id)
    )
    const triggerLabel =
      linkedScopes.length > 0
        ? `Hoàn thành nghiệm thu ${linkedScopes
            .map((s) => s.code || s.title)
            .join(" + ")}`
        : "Theo tiến độ hợp đồng"

    addInstallment(targetContract.id, {
      name: trancheName.trim(),
      percentage: pct,
      amount: amt,
      vatAmount: vatAmt,
      nonVatAmount: amt - vatAmt,
      dueDate: trancheDueDate,
      linkedMilestoneId: selectedMilestoneIds[0],
      linkedMilestoneIds:
        selectedMilestoneIds.length > 0 ? selectedMilestoneIds : undefined,
      triggerMilestoneName: triggerLabel,
      paymentStatus: "PENDING",
      vatInvoiceStatus: "NOT_YET",
    })
    setAddTrancheOpen(false)
    setTrancheName("")
    setSelectedMilestoneIds([])
  }

  const selectedContractForNewTranche = React.useMemo(
    () => contracts.find((c) => c.id === trancheContractId) || contracts[0],
    [contracts, trancheContractId]
  )

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Tài chính, Hóa đơn VAT & Quỹ thưởng 50/50
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Thu tiền theo Mốc bàn giao (1–1 / N–1), Xuất hóa đơn VAT & Mở khóa Quỹ thưởng 50/50 (Cách B)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <IconSearch className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm đợt thu, mốc M1/M2, dự án..."
              className="pl-9 h-9 text-sm bg-white border-slate-200"
            />
          </div>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-60 h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Tất cả Dự án" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                Tất cả Dự án ({contracts.length})
              </SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-sm">
                  {c.contractCode} — {c.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-44 h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Trạng thái thu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Mọi trạng thái thu</SelectItem>
              <SelectItem value="PAID">Đã thu tiền</SelectItem>
              <SelectItem value="INVOICED">Đã gửi ĐNTT</SelectItem>
              <SelectItem value="OVERDUE">Quá hạn</SelectItem>
              <SelectItem value="PENDING">Chờ nghiệm thu Mốc</SelectItem>
            </SelectContent>
          </Select>

          <Select value={vatFilter} onValueChange={setVatFilter}>
            <SelectTrigger className="w-40 h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Hóa đơn VAT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Mọi trạng thái VAT</SelectItem>
              <SelectItem value="ISSUED">Đã xuất đủ VAT</SelectItem>
              <SelectItem value="MISSING">Thiếu VAT</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => setAddTrancheOpen(true)}
            className="h-9 px-4 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white gap-1.5 rounded-lg"
          >
            <IconPlus className="size-4" />
            Thêm Đợt Thu (1-1 / N-1)
          </Button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TABLE 1: LỊCH THU TIỀN THEO MỐC & VAT                               */}
      {/* =================================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-slate-900">
              1. Lịch Thu Tiền Theo Mốc Bàn Giao & Xuất Hóa Đơn VAT (1–1 & Gộp Mốc N–1)
            </h2>
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {filteredInstallmentRows.length} đợt
            </span>
          </div>
          {roleView !== "PM" && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-500">
                Đã thu:{" "}
                <strong className="font-semibold text-slate-900 tabular-nums">
                  {formatMoney(trancheSummary.paidAmount)}
                </strong>
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500">
                Cần đòi ngay:{" "}
                <strong className="font-semibold text-red-600 tabular-nums">
                  {formatMoney(trancheSummary.actionableDebtAmount)}
                </strong>
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 font-medium">Trạng thái thu</th>
                <th className="py-3 px-3 font-medium">Dự án</th>
                <th className="py-3 px-3 font-medium">Đợt thanh toán</th>
                <th className="py-3 px-3 font-medium">
                  Mốc kích hoạt (1–1 / Gộp N–1)
                </th>
                <th className="py-3 px-3 font-medium">Hạn TT</th>
                {roleView !== "PM" && (
                  <th className="py-3 px-3 text-right font-medium">
                    Số tiền (VNĐ)
                  </th>
                )}
                <th className="py-3 px-3 font-medium">Hóa đơn VAT</th>
                <th className="py-3 pl-3 pr-5 text-right font-medium">
                  Thao tác nhanh
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredInstallmentRows.map((row) => {
                const {
                  contract,
                  installment,
                  linkedMilestonesLabel,
                  allLinkedMilestonesFinished,
                } = row
                const isPaid = installment.paymentStatus === "PAID"
                const isReadyToCollect =
                  !isPaid &&
                  (allLinkedMilestonesFinished ||
                    installment.paymentStatus === "INVOICED" ||
                    installment.paymentStatus === "OVERDUE")

                const hasFullVat =
                  installment.vatInvoiceStatus === "ISSUED" &&
                  Boolean(installment.vatInvoiceNumber?.trim())

                return (
                  <tr
                    key={`${contract.id}-${installment.id}`}
                    className="hover:bg-slate-50/90 transition-colors whitespace-nowrap"
                  >
                    {/* 1. Trạng thái thu */}
                    <td className="py-3.5 pl-5 pr-3">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                          <IconCheck className="size-3.5" />
                          Đã thu ({installment.paidDate || "Hoàn tất"})
                        </span>
                      ) : installment.paymentStatus === "OVERDUE" ? (
                        <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200/70">
                          Quá hạn • Cần đòi
                        </span>
                      ) : isReadyToCollect ? (
                        <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200/70">
                          Mốc xong • Đòi tiền
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-600">
                          Chờ nghiệm thu
                        </span>
                      )}
                    </td>

                    {/* 2. Dự án */}
                    <td className="py-3.5 px-3">
                      <button
                        type="button"
                        onClick={() => openContractDetail(contract.id)}
                        className="text-left hover:underline font-semibold text-slate-900"
                      >
                        <span className="font-mono text-xs text-slate-500 mr-2 font-normal">
                          {contract.contractCode}
                        </span>
                        <span>
                          {contract.projectName}
                        </span>
                      </button>
                    </td>

                    {/* 3. Đợt thanh toán */}
                    <td className="py-3.5 px-3 font-medium text-slate-900">
                      {installment.name}{" "}
                      <span className="text-xs font-normal text-slate-500">
                        ({installment.percentage}%)
                      </span>
                    </td>

                    {/* 4. Mốc kích hoạt (1-1 / N-1) */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-700">
                          {linkedMilestonesLabel}
                        </span>
                        {allLinkedMilestonesFinished && (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            ✓ Mốc xong
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 5. Hạn TT */}
                    <td className="py-3.5 px-3 tabular-nums text-slate-600">
                      {installment.dueDate}
                    </td>

                    {/* 6. Số tiền */}
                    {roleView !== "PM" && (
                      <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                        {formatMoney(installment.amount)}
                      </td>
                    )}

                    {/* 7. Hóa đơn VAT */}
                    <td className="py-3.5 px-3">
                      {hasFullVat ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-slate-700">
                          <IconFileText className="size-3.5 text-slate-400" />#
                          {installment.vatInvoiceNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Chưa xuất VAT
                        </span>
                      )}
                    </td>

                    {/* 8. Thao tác nhanh */}
                    <td className="py-3.5 pl-3 pr-5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {!isPaid && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateInstallment(contract.id, installment.id, {
                                paymentStatus: "PAID",
                                paidDate: new Date()
                                  .toISOString()
                                  .slice(0, 10),
                              })
                            }
                            className="h-8 px-2.5 text-xs font-medium border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                          >
                            ✓ Thu tiền
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenVatModal(row)}
                          className="h-8 px-2.5 text-xs border-slate-200 text-slate-700"
                        >
                          {hasFullVat ? "Sửa VAT" : "+ Xuất VAT"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBriefRow(row)}
                          className="h-8 px-2.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                          title="Tạo lệnh xuất hóa đơn gửi Kế toán dịch vụ ngoài"
                        >
                          Phiếu KT
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TABLE 2: QUYẾT TOÁN QUỸ THƯỞNG 50% & DỰ PHÒNG RỦI RO 50%            */}
      {/* =================================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              2. Bảng Quyết Toán Quỹ Thưởng 50% & Quỹ Dự Phòng Rủi Ro 50% Theo Mốc (Cách B)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Mỗi Mốc hoàn thành có dôi dư (Trần tối đa &gt; Thực tế tiêu): 50% giữ lại vào Quỹ dự phòng rủi ro dự án để bù trừ nếu Mốc sau lố trần; 50% thưởng đội dự án và mở khóa ngay khi khách thanh toán Đợt tương ứng.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 font-medium">Dự án</th>
                <th className="py-3 px-3 font-medium">Mã</th>
                <th className="py-3 px-3 font-medium">Tên Mốc bàn giao</th>
                <th className="py-3 px-3 font-medium">Người phụ trách</th>
                <th className="py-3 px-3 text-right font-medium">
                  1. Trần tối đa
                </th>
                <th className="py-3 px-3 text-right font-medium">
                  4. Thực tế tiêu
                </th>
                <th className="py-3 px-3 text-right font-medium">
                  Hỗ trợ 0đ (1:1)
                </th>
                <th className="py-3 px-3 text-right font-medium">
                  Dôi dư / Vượt trần
                </th>
                {roleView !== "PM" && (
                  <>
                    <th className="py-3 px-3 text-right font-medium">
                      50% Quỹ Dự Phòng Rủi Ro
                    </th>
                    <th className="py-3 px-3 text-right font-medium">
                      50% Thưởng Đội Dự Án
                    </th>
                  </>
                )}
                <th className="py-3 pl-3 pr-5 text-right font-medium">
                  Trạng thái Mở Khóa (Cách B)
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {bonusRows.map(({ contract, scopeItem, four }) => {
                const picName = scopeItem.ownerPic || contract.pmOwner
                return (
                  <tr
                    key={`${contract.id}-${scopeItem.id}`}
                    onClick={() => openContractDetail(contract.id)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-slate-500">
                      {contract.contractCode}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs font-semibold text-slate-700">
                      {scopeItem.code}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-900">
                      {scopeItem.title}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <PersonAvatar name={picName} />
                        <span className="text-slate-700">
                          {picName.split("(")[0].trim()}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-slate-700">
                      {four.limitMandays} ngày
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                      {four.realMandays} ngày
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums text-xs">
                      {four.supportMandays > 0 ? (
                        <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700 border border-blue-200/70">
                          {four.supportMandays} ngày (Tách riêng)
                        </span>
                      ) : (
                        <span className="text-slate-400">0 ngày</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "py-3.5 px-3 text-right tabular-nums font-semibold",
                        four.surplusMandays < 0
                          ? "text-red-600"
                          : "text-slate-900"
                      )}
                    >
                      {four.surplusMandays > 0
                        ? `+${four.surplusMandays} ngày`
                        : `${four.surplusMandays} ngày`}
                    </td>
                    {roleView !== "PM" && (
                      <>
                        <td className="py-3.5 px-3 text-right tabular-nums text-slate-700">
                          {four.riskReserve50Md > 0
                            ? `+${four.riskReserve50Md} ngày (${formatMoney(
                                four.riskBuffer50Vnd
                              )})`
                            : "0 đ"}
                        </td>
                        <td className="py-3.5 px-3 text-right tabular-nums font-medium text-slate-900">
                          {four.bonusSplit50Md > 0
                            ? `+${four.bonusSplit50Md} ngày (${formatMoney(
                                four.teamBonus50Vnd
                              )})`
                            : "0 đ"}
                        </td>
                      </>
                    )}
                    <td className="py-3.5 pl-3 pr-5 text-right">
                      {four.bonusUnlockStatus === "UNLOCKED" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/70">
                          ✓ Đã mở khóa • Chi ngay
                        </span>
                      ) : four.bonusUnlockStatus === "PENDING_PAYMENT" ? (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          Chờ khách thanh toán
                        </span>
                      ) : four.bonusUnlockStatus === "OVER_LIMIT" ? (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200/70">
                          Lố trần ({four.surplusMandays} ngày)
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Đang triển khai
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* DIALOG 1: XUẤT HÓA ĐƠN VAT                                          */}
      {/* =================================================================== */}
      <Dialog
        open={!!issuingRow}
        onOpenChange={(o) => !o && setIssuingRow(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Cập Nhật Số Hóa Đơn VAT & Tải File Lên Hệ Thống
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bắt buộc đính kèm Số hóa đơn và File PDF VAT để đủ điều kiện đóng dự án.
            </DialogDescription>
          </DialogHeader>
          {issuingRow && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div className="font-semibold text-slate-900">
                  {issuingRow.contract.contractCode} —{" "}
                  {issuingRow.installment.name}
                </div>
                <div className="text-slate-500">
                  Khách hàng: {issuingRow.contract.customerName} • Số tiền:{" "}
                  <strong>{formatMoney(issuingRow.installment.amount)}</strong>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Số Hóa đơn Điện tử VAT *</Label>
                <Input
                  value={vatNumberDraft}
                  onChange={(e) => setVatNumberDraft(e.target.value)}
                  placeholder="VD: 0001688"
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">File PDF Hóa đơn VAT *</Label>
                <input
                  ref={vatFileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setVatUrlDraft(f.name)
                  }}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => vatFileInputRef.current?.click()}
                    className="h-8 text-xs gap-1.5"
                  >
                    <IconUpload className="size-3.5" />
                    Chọn file PDF...
                  </Button>
                  <Input
                    value={vatUrlDraft}
                    onChange={(e) => setVatUrlDraft(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIssuingRow(null)}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmVatModal}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Lưu Hóa đơn VAT
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* DIALOG 2: PHIẾU GIAO VIỆC KẾ TOÁN DỊCH VỤ NGOÀI (1-CLICK COPY)       */}
      {/* =================================================================== */}
      <Dialog open={!!briefRow} onOpenChange={(o) => !o && setBriefRow(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Phiếu Yêu Cầu Xuất Hóa Đơn VAT (Gửi Kế Toán Ngoài)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Tổng hợp sẵn MST, Tên công ty, Nội dung xuất HĐ và Số tiền để AM Thảo copy gửi Zalo/Email cho Kế toán dịch vụ.
            </DialogDescription>
          </DialogHeader>
          {briefRow &&
            (() => {
              const cust = customers.find(
                (c) => c.id === briefRow.contract.customerId
              )
              const briefText = [
                `[YÊU CẦU XUẤT HÓA ĐƠN VAT - ${briefRow.contract.contractCode}]`,
                `- Đơn vị mua hàng: ${briefRow.contract.customerName}`,
                `- Mã số thuế: ${cust?.taxCode || "0314558899"}`,
                `- Địa chỉ: ${cust?.address || "TP. Hồ Chí Minh"}`,
                `- Email nhận HĐĐT: ${
                  cust?.accountingContact.email || "accounting@client.vn"
                }`,
                `- Nội dung xuất HĐ: Thanh toán ${briefRow.installment.name} (${briefRow.linkedMilestonesLabel}) theo Hợp đồng ${briefRow.contract.contractCode}`,
                `- Tổng thanh toán: ${briefRow.installment.amount.toLocaleString(
                  "vi-VN"
                )} VNĐ (Chưa VAT: ${briefRow.installment.nonVatAmount.toLocaleString(
                  "vi-VN"
                )} đ | Thuế VAT: ${briefRow.installment.vatAmount.toLocaleString(
                  "vi-VN"
                )} đ)`,
              ].join("\n")

              return (
                <div className="space-y-3 py-2">
                  <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-mono whitespace-pre-wrap text-slate-800 leading-relaxed">
                    {briefText}
                  </pre>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBriefRow(null)}
                    >
                      Đóng
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                      onClick={() => {
                        navigator.clipboard.writeText(briefText)
                        updateInstallment(
                          briefRow.contract.id,
                          briefRow.installment.id,
                          {
                            vatInvoiceStatus: "SENT_TO_ACCOUNTANT",
                          }
                        )
                        toast.success(
                          "Đã copy Phiếu giao việc Kế toán & đánh dấu Đã gửi KT!"
                        )
                        setBriefRow(null)
                      }}
                    >
                      <IconCopy className="size-3.5" />
                      Copy gửi Zalo Kế toán
                    </Button>
                  </div>
                </div>
              )
            })()}
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* DIALOG 3: + THÊM ĐỢT THANH TOÁN (HỖ TRỢ 1-1 VÀ GỘP N-1 MỐC)         */}
      {/* =================================================================== */}
      <Dialog open={addTrancheOpen} onOpenChange={setAddTrancheOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              Thêm Đợt Thanh Toán Mới (Liên Kết 1–1 Hoặc Gộp Mốc N–1)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Chọn 1 hoặc nhiều Mốc bàn giao (VD: xong cả M1 + M2 mới thu Đợt 1) để hệ thống tự động bật cảnh báo đòi tiền và mở khóa thưởng 50%.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Thuộc Dự án / Hợp đồng</Label>
              <Select
                value={trancheContractId}
                onValueChange={(v) => {
                  setTrancheContractId(v)
                  setSelectedMilestoneIds([])
                }}
              >
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.contractCode} — {c.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tên Đợt thanh toán *</Label>
                <Input
                  value={trancheName}
                  onChange={(e) => setTrancheName(e.target.value)}
                  placeholder="VD: Đợt 2 - Nghiệm thu M1 + M2"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Hạn thanh toán</Label>
                <Input
                  type="date"
                  value={trancheDueDate}
                  onChange={(e) => setTrancheDueDate(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Tỷ lệ (%)</Label>
                <Input
                  type="number"
                  value={tranchePct}
                  onChange={(e) => setTranchePct(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Số tiền (VNĐ gồm VAT)</Label>
                <Input
                  type="number"
                  value={trancheAmount}
                  onChange={(e) => setTrancheAmount(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
            </div>

            {selectedContractForNewTranche && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs">
                  Chọn các Mốc bàn giao cần hoàn thành để thu Đợt này (Hỗ trợ 1–1 hoặc Gộp N–1):
                </Label>
                <div className="rounded-lg border border-slate-200 p-2.5 space-y-2 max-h-40 overflow-y-auto">
                  {selectedContractForNewTranche.scopeItems.map((s, idx) => {
                    const checked = selectedMilestoneIds.includes(s.id)
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 cursor-pointer text-xs"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (v) {
                              setSelectedMilestoneIds((prev) => [...prev, s.id])
                            } else {
                              setSelectedMilestoneIds((prev) =>
                                prev.filter((id) => id !== s.id)
                              )
                            }
                          }}
                        />
                        <span className="font-mono font-bold text-slate-700">
                          {s.code || `M${idx + 1}`}:
                        </span>
                        <span className="text-slate-800">{s.title}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddTrancheOpen(false)}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleCreateInstallment}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Tạo Đợt thanh toán
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
