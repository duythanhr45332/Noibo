"use client"

import * as React from "react"
import {
  IconArrowRight,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import {
  ChangeRequestItem,
  ChangeRequestStatus,
  formatVnd,
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
    label: "Đang báo giá khách",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  APPROVED_UPSELL: {
    label: "Khách đã duyệt Upsell",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  APPROVED_FREE_GOODWILL: {
    label: "Hỗ trợ miễn phí (0đ)",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  REJECTED: {
    label: "Đã từ chối",
    className: "bg-slate-100 text-slate-500 border-slate-200",
  },
}

interface FlattenedCrRow {
  contractId: string
  contractCode: string
  projectName: string
  customerName: string
  pmOwner: string
  cr: ChangeRequestItem
}

export function ChangeRequestListView() {
  const {
    contracts,
    roleView,
    formatMoney,
    openContractDetail,
    addChangeRequest,
    resolveChangeRequest,
  } = useAmPrototype()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")
  const [contractFilter, setContractFilter] = React.useState<string>("ALL")

  // Modal tạo CR mới
  const [crModalOpen, setCrModalOpen] = React.useState(false)
  const [targetContractId, setTargetContractId] = React.useState<string>(
    contracts[0]?.id || ""
  )
  const [crTitle, setCrTitle] = React.useState("")
  const [crRequestedBy, setCrRequestedBy] = React.useState("Đại diện phía Khách hàng")
  const [crEstimatedMd, setCrEstimatedMd] = React.useState<number>(8)
  const [crQuotedPrice, setCrQuotedPrice] = React.useState<number>(28_000_000)
  const [crTimelineDays, setCrTimelineDays] = React.useState<number>(5)
  const [crVatCat, setCrVatCat] = React.useState<VatCategory>("NON_VAT")

  // Modal xác nhận duyệt Upsell
  const [approvingRow, setApprovingRow] = React.useState<FlattenedCrRow | null>(null)
  const [approvedPriceDraft, setApprovedPriceDraft] = React.useState<number>(0)
  const [allocatedToPmDraft, setAllocatedToPmDraft] = React.useState<number>(0)
  const [autoCreateInstallmentDraft, setAutoCreateInstallmentDraft] =
    React.useState<boolean>(true)
  const [upsellDueDateDraft, setUpsellDueDateDraft] = React.useState<string>("")

  const allCrRows = React.useMemo<FlattenedCrRow[]>(() => {
    const list: FlattenedCrRow[] = []
    contracts.forEach((c) => {
      c.changeRequests.forEach((cr) => {
        list.push({
          contractId: c.id,
          contractCode: c.contractCode,
          projectName: c.projectName,
          customerName: c.customerName,
          pmOwner: c.pmOwner,
          cr,
        })
      })
    })
    return list
  }, [contracts])

  const stats = React.useMemo(() => {
    let pendingCount = 0
    let approvedUpsellCount = 0
    let totalUpsellRevenue = 0
    let totalUpsellMandays = 0

    allCrRows.forEach(({ cr }) => {
      if (cr.status === "AM_QUOTING" || cr.status === "PM_ESTIMATING") {
        pendingCount++
      }
      if (cr.status === "APPROVED_UPSELL") {
        approvedUpsellCount++
        totalUpsellRevenue += cr.quotedPriceVnd
        totalUpsellMandays += cr.pmEstimatedMandays
      }
    })

    return {
      totalCount: allCrRows.length,
      pendingCount,
      approvedUpsellCount,
      totalUpsellRevenue,
      totalUpsellMandays,
    }
  }, [allCrRows])

  const filteredRows = React.useMemo(() => {
    return allCrRows.filter((row) => {
      if (statusFilter !== "ALL" && row.cr.status !== statusFilter) return false
      if (contractFilter !== "ALL" && row.contractId !== contractFilter) return false
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase()
        return (
          row.cr.title.toLowerCase().includes(q) ||
          row.cr.code.toLowerCase().includes(q) ||
          row.projectName.toLowerCase().includes(q) ||
          row.contractCode.toLowerCase().includes(q) ||
          row.customerName.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [allCrRows, statusFilter, contractFilter, searchQuery])

  const handleCreateCrSubmit = () => {
    if (!crTitle.trim() || !targetContractId) return
    const targetContract = contracts.find((c) => c.id === targetContractId)
    addChangeRequest(targetContractId, {
      milestoneId: targetContract?.scopeItems[0]?.id || "ms-1",
      crType: "UPSELL",
      title: crTitle.trim(),
      requestedDate: new Date().toISOString().slice(0, 10),
      requestedByClientContact: crRequestedBy,
      description: crTitle.trim(),
      devMandays: Math.max(1, Math.round(crEstimatedMd / 3)),
      pmEstimatedMandays: crEstimatedMd,
      quotedPriceVnd: crQuotedPrice,
      vatCategory: crVatCat,
      timelineImpactDays: crTimelineDays,
      status: "AM_QUOTING",
      amNegotiationNote: `PM estimate +${crEstimatedMd} MD. AM Thảo đang gửi báo giá ${formatVnd(crQuotedPrice)} cho khách.`,
    })
    setCrModalOpen(false)
    setCrTitle("")
  }

  const handleOpenApproveUpsell = (row: FlattenedCrRow) => {
    const parentContract = contracts.find((c) => c.id === row.contractId)
    setApprovingRow(row)
    setApprovedPriceDraft(row.cr.quotedPriceVnd)
    setAllocatedToPmDraft(row.cr.pmEstimatedMandays)
    setAutoCreateInstallmentDraft(true)
    setUpsellDueDateDraft(
      parentContract?.expectedEndDate || new Date().toISOString().slice(0, 10)
    )
  }

  const handleConfirmApproveUpsell = () => {
    if (!approvingRow) return
    resolveChangeRequest(
      approvingRow.contractId,
      approvingRow.cr.id,
      "APPROVED_UPSELL",
      approvedPriceDraft,
      allocatedToPmDraft,
      autoCreateInstallmentDraft,
      upsellDueDateDraft
    )
    setApprovingRow(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Danh Sách Yêu Cầu Phát Sinh & Upsell (Change Requests)
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi tập trung toàn bộ tính năng phát sinh ngoài hợp đồng, đàm phán báo giá Upsell và cộng thêm Mandays cho dự án
          </p>
        </div>

        <Button
          onClick={() => setCrModalOpen(true)}
          className="gap-1.5 bg-primary hover:bg-primary/90 text-white h-9 text-xs"
        >
          <IconPlus className="size-4" />
          Ghi nhận Phát sinh (CR) mới
        </Button>
      </div>

      {/* 3 Thẻ Tóm tắt nhanh */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-none border bg-card">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground">
              Tổng số Yêu cầu phát sinh (CR)
            </div>
            <div className="text-3xl font-bold text-foreground mt-2">
              {stats.totalCount}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Trên toàn bộ {contracts.length} hợp đồng dự án
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-card">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground">
              CR đang chờ AM báo giá / Chờ khách duyệt
            </div>
            <div className="text-3xl font-bold text-amber-600 mt-2">
              {stats.pendingCount}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Cần AM Thảo chốt phụ lục trước khi cho Dev làm
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-none border bg-card">
          <CardContent className="p-5">
            <div className="text-xs font-medium text-muted-foreground">
              Đã chốt Upsell thành công ({stats.approvedUpsellCount} CR)
            </div>
            <div className="text-2xl font-bold text-emerald-700 mt-2">
              {roleView === "PM"
                ? `+${stats.totalUpsellMandays} Mandays`
                : `${formatMoney(stats.totalUpsellRevenue)} (+${stats.totalUpsellMandays} MD)`}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Đã cộng vào Trần Credit và đẩy sang Checklist nghiệm thu
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bảng Danh sách CR toàn công ty */}
      <Card className="shadow-none border bg-card overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <IconSearch className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã CR, tên tính năng phát sinh, dự án..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={contractFilter} onValueChange={setContractFilter}>
              <SelectTrigger className="w-64 h-9 text-xs">
                <SelectValue placeholder="Tất cả Hợp đồng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả Hợp đồng</SelectItem>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    [{c.contractCode}] {c.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue placeholder="Mọi trạng thái CR" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Mọi trạng thái CR</SelectItem>
                <SelectItem value="AM_QUOTING">Đang báo giá khách</SelectItem>
                <SelectItem value="APPROVED_UPSELL">Khách đã duyệt Upsell</SelectItem>
                <SelectItem value="APPROVED_FREE_GOODWILL">Hỗ trợ miễn phí (0đ)</SelectItem>
                <SelectItem value="REJECTED">Đã từ chối</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead className="w-[10%] pl-5 py-3 text-xs">Mã CR</TableHead>
              <TableHead className="w-[26%] text-xs">
                Tính năng phát sinh & Ghi chú đàm phán
              </TableHead>
              <TableHead className="w-[22%] text-xs">
                Thuộc Hợp đồng / Khách hàng
              </TableHead>
              <TableHead className="w-[10%] text-center text-xs">
                Estimate (+MD)
              </TableHead>
              {roleView !== "PM" && (
                <TableHead className="w-[12%] text-xs">Giá báo Upsell</TableHead>
              )}
              <TableHead className="w-[12%] text-xs">Trạng thái</TableHead>
              <TableHead className="w-[8%] pr-5 text-right text-xs">
                Xử lý / Mở HĐ
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => {
              const { cr } = row
              const st = CR_STATUS_BADGE[cr.status]
              const isPending =
                cr.status === "AM_QUOTING" || cr.status === "PM_ESTIMATING"

              return (
                <TableRow key={cr.id} className="hover:bg-slate-50/70">
                  <TableCell className="pl-5 py-4 font-mono text-xs font-semibold text-foreground">
                    <div>{cr.code}</div>
                    <div className="text-[11px] font-normal text-muted-foreground mt-0.5">
                      {cr.requestedDate}
                    </div>
                  </TableCell>

                  <TableCell className="py-4 whitespace-normal">
                    <div className="font-medium text-sm text-foreground">
                      {cr.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {cr.amNegotiationNote}
                    </div>
                  </TableCell>

                  <TableCell className="py-4 whitespace-normal">
                    <div className="text-xs font-semibold text-foreground">
                      {row.projectName}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {row.contractCode} • {row.customerName}
                    </div>
                  </TableCell>

                  <TableCell className="py-4 text-center">
                    <Badge variant="secondary" className="font-mono text-xs">
                      +{cr.pmEstimatedMandays} MD
                    </Badge>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      +{cr.timelineImpactDays} ngày
                    </div>
                  </TableCell>

                  {roleView !== "PM" && (
                    <TableCell className="py-4 text-xs font-semibold text-foreground">
                      {formatMoney(cr.quotedPriceVnd)}
                    </TableCell>
                  )}

                  <TableCell className="py-4">
                    <Badge variant="outline" className={st.className}>
                      {st.label}
                    </Badge>
                  </TableCell>

                  <TableCell className="pr-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isPending && roleView !== "PM" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => handleOpenApproveUpsell(row)}
                        >
                          Duyệt Upsell
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-primary gap-1"
                        onClick={() =>
                          openContractDetail(row.contractId, "in-project")
                        }
                      >
                        <span>Hồ sơ HĐ</span>
                        <IconArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Modal Tạo CR mới */}
      <Dialog open={crModalOpen} onOpenChange={setCrModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ghi Nhận Yêu Cầu Phát Sinh (CR) Mới</DialogTitle>
            <DialogDescription className="text-xs">
              Chọn hợp đồng cần ghi nhận phát sinh, nhập số Mandays do PM ước tính và giá bán báo khách.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Thuộc Hợp đồng / Dự án</Label>
              <Select value={targetContractId} onValueChange={setTargetContractId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      [{c.contractCode}] {c.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tên tính năng phát sinh</Label>
              <Input
                value={crTitle}
                onChange={(e) => setCrTitle(e.target.value)}
                placeholder="VD: Tích hợp cổng thanh toán tự động VietQR"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">PM Estimate (+MD)</Label>
                <Input
                  type="number"
                  value={crEstimatedMd}
                  onChange={(e) => setCrEstimatedMd(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Giá báo khách (VNĐ)</Label>
                <Input
                  type="number"
                  step={5_000_000}
                  value={crQuotedPrice}
                  onChange={(e) => setCrQuotedPrice(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Giãn lịch (+Ngày)</Label>
                <Input
                  type="number"
                  value={crTimelineDays}
                  onChange={(e) => setCrTimelineDays(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Phân loại Thuế VAT</Label>
                <Select
                  value={crVatCat}
                  onValueChange={(v) => setCrVatCat(v as VatCategory)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NON_VAT">Không chịu VAT</SelectItem>
                    <SelectItem value="VAT_8">Chịu VAT 8%</SelectItem>
                    <SelectItem value="VAT_10">Chịu VAT 10%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Đầu mối yêu cầu phía khách</Label>
                <Input
                  value={crRequestedBy}
                  onChange={(e) => setCrRequestedBy(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCrModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateCrSubmit}>Lưu & Báo giá</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Duyệt Upsell */}
      <Dialog
        open={!!approvingRow}
        onOpenChange={(o) => !o && setApprovingRow(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác Nhận Khách Hàng Duyệt Phụ Lục Upsell</DialogTitle>
            <DialogDescription className="text-xs">
              Toàn bộ +{approvingRow?.cr.pmEstimatedMandays} MD sẽ được cộng vào Trần Max Credit. AM Thảo có thể chọn số Mandays phân bổ thêm vào Mốc ép (Target MD) của PM.
            </DialogDescription>
          </DialogHeader>
          {approvingRow && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-md bg-slate-50 border p-3 space-y-1">
                <div className="font-semibold text-foreground">
                  {approvingRow.cr.title}
                </div>
                <div className="text-muted-foreground">
                  Dự án: {approvingRow.projectName} • Cộng vào Trần Max Credit:{" "}
                  <strong>+{approvingRow.cr.pmEstimatedMandays} MD</strong>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Giá trị Phụ lục Upsell chốt ký (VNĐ)</Label>
                <Input
                  type="number"
                  step={5_000_000}
                  value={approvedPriceDraft}
                  onChange={(e) => setApprovedPriceDraft(Number(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Số Mandays cộng thêm cho Mốc ép của PM (Target MD) (Tối đa +{approvingRow.cr.pmEstimatedMandays} MD)
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={approvingRow.cr.pmEstimatedMandays}
                  value={allocatedToPmDraft}
                  onChange={(e) =>
                    setAllocatedToPmDraft(
                      Math.min(
                        approvingRow.cr.pmEstimatedMandays,
                        Math.max(0, Number(e.target.value) || 0)
                      )
                    )
                  }
                />
              </div>

              <div className="rounded-md border bg-slate-50/70 p-3 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={autoCreateInstallmentDraft}
                    onCheckedChange={(v) =>
                      setAutoCreateInstallmentDraft(Boolean(v))
                    }
                  />
                  <span className="font-medium text-foreground">
                    Tự động tạo Đợt thanh toán Phụ lục Upsell vào Lộ trình thu tiền & VAT
                  </span>
                </label>

                {autoCreateInstallmentDraft && (
                  <div className="space-y-1 pt-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Hạn thanh toán dự kiến của Đợt Phụ lục Upsell
                    </Label>
                    <Input
                      type="date"
                      value={upsellDueDateDraft}
                      onChange={(e) => setUpsellDueDateDraft(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovingRow(null)}>
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
