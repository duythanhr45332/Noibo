"use client"

import * as React from "react"
import {
  IconCheck,
  IconClipboardText,
  IconCopy,
  IconFileText,
  IconLock,
  IconLockOpen,
  IconUpload,
  IconUser,
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
import { Slider } from "@/components/ui/slider"
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
  calculateContractMetrics,
  getMilestoneFourMetrics,
  PaymentInstallment,
} from "@/lib/mock/am-types"

export function PostProjectOffboardingView() {
  const {
    customers,
    selectedContract,
    roleView,
    formatMoney,
    toggleScopeItemAccepted,
    acceptAllScopeItems,
    updateInstallment,
    updateHandover,
    addContractDocument,
    updateKpiSplitPercent,
    closeProjectAndSettleKpi,
  } = useAmPrototype()

  const [accountantModalOpen, setAccountantModalOpen] = React.useState(false)
  const vatFileInputRef = React.useRef<HTMLInputElement | null>(null)
  const acceptanceScanInputRef = React.useRef<HTMLInputElement | null>(null)

  // Modal bắt buộc nhập Số hóa đơn + Tải file hóa đơn VAT lên hệ thống
  const [issuingVatInstallment, setIssuingVatInstallment] =
    React.useState<PaymentInstallment | null>(null)
  const [vatInvoiceNumberDraft, setVatInvoiceNumberDraft] = React.useState("")
  const [vatInvoiceUrlDraft, setVatInvoiceUrlDraft] = React.useState("")

  const metrics = calculateContractMetrics(selectedContract)
  const customerObj = React.useMemo(
    () =>
      customers.find((c) => c.id === selectedContract.customerId) || customers[0],
    [customers, selectedContract.customerId]
  )

  const handleOpenIssueVatModal = (inst: PaymentInstallment, idx: number) => {
    const num = inst.vatInvoiceNumber || `000160${idx + 1}`
    setIssuingVatInstallment(inst)
    setVatInvoiceNumberDraft(num)
    setVatInvoiceUrlDraft(
      inst.vatInvoiceFileUrl || `Hoa-don-VAT-${num}.pdf`
    )
  }

  const handleVatFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVatInvoiceUrlDraft(file.name)
    }
    e.target.value = ""
  }

  const handleAcceptanceScanFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const sizeMb = `${Math.max(0.1, file.size / (1024 * 1024)).toFixed(1)} MB`
    updateHandover(selectedContract.id, {
      signedAcceptanceScanUploaded: true,
      acceptanceScanFileName: file.name,
    })
    addContractDocument(selectedContract.id, {
      fileName: file.name,
      fileSize: sizeMb,
      category: "CONTRACT_SCAN",
      uploadedBy: roleView === "PM" ? selectedContract.pmOwner : "Thảo (AM)",
    })
    toast.success(
      `Đã tải lên "${file.name}" và lưu đồng bộ vào Kho tài liệu hợp đồng!`
    )
    e.target.value = ""
  }

  const handleConfirmIssueVat = () => {
    if (!issuingVatInstallment) return
    if (!vatInvoiceNumberDraft.trim() || !vatInvoiceUrlDraft.trim()) {
      toast.error(
        "Bắt buộc nhập đầy đủ Số hóa đơn VAT và Tải file Hóa đơn VAT lên hệ thống!"
      )
      return
    }
    updateInstallment(selectedContract.id, issuingVatInstallment.id, {
      vatInvoiceStatus: "ISSUED",
      vatInvoiceNumber: vatInvoiceNumberDraft.trim(),
      vatInvoiceFileUrl: vatInvoiceUrlDraft.trim(),
    })
    setIssuingVatInstallment(null)
  }

  const handleFastTrackUnlockAll = () => {
    acceptAllScopeItems(selectedContract.id)
    updateHandover(selectedContract.id, {
      sourceCodeDelivered: true,
      userGuideAndVideoDelivered: true,
      signedAcceptanceScanUploaded: true,
    })
    selectedContract.installments.forEach((inst, idx) => {
      const num = inst.vatInvoiceNumber || `000159${idx + 1}`
      updateInstallment(selectedContract.id, inst.id, {
        paymentStatus: "PAID",
        paidDate: inst.paidDate || new Date().toISOString().slice(0, 10),
        vatInvoiceStatus: "ISSUED",
        vatInvoiceNumber: num,
        vatInvoiceFileUrl:
          inst.vatInvoiceFileUrl || `Hoa-don-VAT-${num}.pdf`,
      })
    })
    toast.success("Đã hoàn tất đủ 4 điều kiện! Nút Close Project đã mở khóa.")
  }

  const accountantBriefText = `PHIẾU YÊU CẦU XUẤT HÓA ĐƠN GTGT (KẾ TOÁN NGOÀI)
------------------------------------------------------------
Hợp đồng: ${selectedContract.contractCode} - ${selectedContract.projectName}
Khách hàng: ${customerObj.companyName}
Mã số thuế: ${customerObj.taxCode}
Địa chỉ: ${customerObj.address}
Email nhận HĐ: ${customerObj.accountingContact.email}
------------------------------------------------------------
- Khoản Không chịu VAT (Phần mềm): ${formatMoney(selectedContract.nonVatPortionAmount)}
- Khoản Chịu VAT (${selectedContract.vatRatePercent}%): ${formatMoney(selectedContract.vatPortionAmount)}
- Tổng cộng: ${formatMoney(metrics.totalContractValue)}`

  return (
    <div className="space-y-6">
      {!metrics.canCloseProject && selectedContract.phase !== "CLOSED" && (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleFastTrackUnlockAll}
            className="h-8 text-xs"
          >
            Hoàn tất nhanh 4 điều kiện (Demo)
          </Button>
        </div>
      )}

      {/* 4 Điều kiện mở khóa (Gatekeepers) tối giản trên 1 hàng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "1. Nghiệm thu Mốc Bàn Giao 100%",
            done: metrics.scopeAcceptancePercent === 100,
            sub: `${metrics.acceptedScopeCount}/${metrics.totalScopeCount} mốc bàn giao (${metrics.scopeAcceptancePercent}%)`,
          },
          {
            label: "2. Bàn giao 3 Mục Chuẩn",
            done: metrics.isHandoverComplete,
            sub: metrics.isHandoverComplete
              ? "Đã đủ 3/3 mục bàn giao"
              : "Chưa tích đủ 3 checkbox",
          },
          {
            label: "3. Thu đủ 100% Đợt Thanh Toán",
            done: metrics.isAllInstallmentsPaid,
            sub:
              roleView === "PM"
                ? metrics.isAllInstallmentsPaid
                  ? "Khách đã thanh toán đủ"
                  : "Chờ khách tất toán"
                : `Đã thu: ${formatMoney(metrics.totalPaidAmount)}`,
          },
          {
            label: "4. Xuất HĐ VAT (Số HĐ + File)",
            done: metrics.isAllVatIssued,
            sub: metrics.isAllVatIssued
              ? "Đã lưu đủ Số HĐ & File VAT"
              : "Cần nhập Số HĐ & Link file VAT",
          },
        ].map((gate, i) => (
          <Card key={i} className="shadow-none border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className={
                  gate.done
                    ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
                    : "flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-semibold"
                }
              >
                {gate.done ? <IconCheck className="size-4" /> : i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {gate.label}
                </div>
                <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {gate.sub}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2 Cột: Trái (Mốc bàn giao + Đợt Thanh toán VAT) | Phải (Bàn giao 3 Checkbox + Quyết toán 50/50) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Checklist Mốc bàn giao 100% */}
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  1. Nghiệm Thu Mốc Bàn Giao & Đối Soát 4 Chỉ Số Tài Chính ({metrics.scopeAcceptancePercent}%)
                </CardTitle>
                {metrics.scopeAcceptancePercent < 100 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => acceptAllScopeItems(selectedContract.id)}
                  >
                    Nghiệm thu tất cả (100%)
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="w-[45px] pl-4 text-xs">Đạt</TableHead>
                    <TableHead className="text-xs">Mốc bàn giao & Người phụ trách (PIC)</TableHead>
                    <TableHead className="w-[155px] text-center text-xs">
                      Limit | Target | Est | Real
                    </TableHead>
                    <TableHead className="w-[95px] pr-4 text-right text-xs">
                      Dôi dư / Vượt
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedContract.scopeItems.map((item) => {
                    const fm = getMilestoneFourMetrics(
                      item,
                      selectedContract
                    )
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="pl-4">
                          <Checkbox
                            checked={item.isAccepted}
                            onCheckedChange={(v) =>
                              toggleScopeItemAccepted(
                                selectedContract.id,
                                item.id,
                                Boolean(v)
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="py-3 whitespace-normal">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[11px] font-bold text-primary">
                              {item.code}
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              {item.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                              <IconUser className="size-3" />
                              {item.ownerPic || selectedContract.pmOwner}
                            </span>
                            <span>•</span>
                            <span>
                              {item.source === "BASELINE" ? "HĐ Gốc" : "Upsell CR"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-[11px]">
                          <span className="text-slate-600">{fm.limitMandays}</span>
                          {" | "}
                          <span className="text-blue-700 font-semibold">
                            {fm.targetMandays}
                          </span>
                          {" | "}
                          <span className="text-violet-700">
                            {fm.estimateMandays}
                          </span>
                          {" | "}
                          <strong
                            className={
                              fm.isOverLimit ? "text-red-600" : "text-emerald-700"
                            }
                          >
                            {fm.realMandays}
                          </strong>
                        </TableCell>
                        <TableCell className="pr-4 text-right font-mono text-xs">
                          <Badge
                            variant="outline"
                            className={
                              fm.surplusMandays >= 0
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                : "bg-red-50 text-red-700 border-red-200 text-[10px]"
                            }
                          >
                            {fm.surplusMandays >= 0
                              ? `+${fm.surplusMandays} MD`
                              : `${fm.surplusMandays} MD`}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Đối soát Thanh toán & Xuất Hóa đơn VAT (Bắt buộc Số HĐ + Link File VAT) */}
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  2. Đối Soát Đợt Thanh Toán & Kế Toán Ngoài Xuất Hóa Đơn VAT
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setAccountantModalOpen(true)}
                >
                  <IconClipboardText className="size-3.5" />
                  Phiếu giao Kế toán ngoài
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="pl-4 text-xs">
                      Đợt thanh toán (% Dòng tiền)
                    </TableHead>
                    {roleView !== "PM" && (
                      <TableHead className="text-xs">Số tiền</TableHead>
                    )}
                    <TableHead className="text-xs">Thu tiền</TableHead>
                    <TableHead className="pr-4 text-xs">
                      Hóa đơn VAT (Số HĐ + File)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedContract.installments.map((inst, idx) => {
                    const hasFullVatInfo =
                      inst.vatInvoiceStatus === "ISSUED" &&
                      Boolean(inst.vatInvoiceNumber?.trim()) &&
                      Boolean(inst.vatInvoiceFileUrl?.trim())

                    return (
                      <TableRow key={inst.id}>
                        <TableCell className="pl-4 py-3">
                          <div className="text-xs font-medium">{inst.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Liên kết: {inst.triggerMilestoneName}
                          </div>
                        </TableCell>
                        {roleView !== "PM" && (
                          <TableCell className="py-3 text-xs font-semibold">
                            {formatMoney(inst.amount)}
                          </TableCell>
                        )}
                        <TableCell className="py-3">
                          {inst.paymentStatus === "PAID" ? (
                            <span className="text-xs text-emerald-700 font-medium">
                              ✓ Đã thu ({inst.paidDate})
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                updateInstallment(selectedContract.id, inst.id, {
                                  paymentStatus: "PAID",
                                  paidDate: new Date().toISOString().slice(0, 10),
                                })
                              }
                            >
                              Xác nhận Đã thu
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 py-3">
                          {hasFullVatInfo ? (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-emerald-700 font-medium">
                                ✓ HĐ #{inst.vatInvoiceNumber}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] gap-1 bg-slate-50"
                              >
                                <IconFileText className="size-3 text-primary" />
                                <span className="max-w-[110px] truncate">
                                  {inst.vatInvoiceFileUrl}
                                </span>
                              </Badge>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleOpenIssueVatModal(inst, idx)}
                            >
                              <IconUpload className="size-3.5" />
                              Nhập Số HĐ & Tải File VAT
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Cột phải (5 phần): 3 Checkbox Bàn giao tối giản & Quyết toán 50/50 */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-semibold">
                3. Checklist Bàn Giao Sản Phẩm (3 Checkbox Tối Giản)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <label className="flex items-center gap-3 rounded-md border p-3 text-xs cursor-pointer hover:bg-slate-50">
                <Checkbox
                  checked={selectedContract.handover.sourceCodeDelivered}
                  onCheckedChange={(v) =>
                    updateHandover(selectedContract.id, {
                      sourceCodeDelivered: Boolean(v),
                    })
                  }
                />
                <span>1. Đã bàn giao Source Code</span>
              </label>

              <label className="flex items-center gap-3 rounded-md border p-3 text-xs cursor-pointer hover:bg-slate-50">
                <Checkbox
                  checked={selectedContract.handover.userGuideAndVideoDelivered}
                  onCheckedChange={(v) =>
                    updateHandover(selectedContract.id, {
                      userGuideAndVideoDelivered: Boolean(v),
                    })
                  }
                />
                <span>2. Đã bàn giao Tài liệu / Video hướng dẫn sử dụng</span>
              </label>

              <div className="rounded-md border p-3 text-xs space-y-2.5 bg-background">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={selectedContract.handover.signedAcceptanceScanUploaded}
                      onCheckedChange={(v) =>
                        updateHandover(selectedContract.id, {
                          signedAcceptanceScanUploaded: Boolean(v),
                        })
                      }
                    />
                    <span>3. Đã upload bản Scan Biên bản nghiệm thu có chữ ký</span>
                  </label>
                  <input
                    ref={acceptanceScanInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg"
                    className="hidden"
                    onChange={handleAcceptanceScanFileSelect}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] gap-1 shrink-0"
                    onClick={() => acceptanceScanInputRef.current?.click()}
                  >
                    <IconUpload className="size-3.5" />
                    Chọn file từ máy
                  </Button>
                </div>

                {selectedContract.handover.signedAcceptanceScanUploaded && (
                  <div className="flex items-center justify-between rounded bg-emerald-50/70 border border-emerald-200 px-2.5 py-1.5 text-[11px] text-emerald-800">
                    <span className="flex items-center gap-1.5 truncate">
                      <IconFileText className="size-3.5 text-emerald-600 shrink-0" />
                      <strong className="truncate">
                        {selectedContract.handover.acceptanceScanFileName ||
                          `Bien-ban-nghiem-thu-${selectedContract.contractCode.replace(/\//g, "-")}.pdf`}
                      </strong>
                    </span>
                    <span className="text-[10px] text-emerald-700 shrink-0 ml-2">
                      Đã lưu vào Kho tài liệu HĐ
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quyết toán Dự án & Phân bổ Thưởng Dôi Dư 50/50 */}
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  4. Quyết Toán 4 Chỉ Số & Chia Thưởng Dôi Dư (50/50)
                </CardTitle>
                {selectedContract.phase === "CLOSED" && (
                  <Badge className="bg-emerald-600 text-white">Đã đóng dự án</Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="rounded-lg border bg-slate-50/80 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    1. Limit (Hạn mức công ty cấp + Upsell):
                  </span>
                  <strong>
                    {roleView === "PM" ? "Đã ẩn" : `${metrics.totalMaxMandays} MD`}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    2. Target (Mục tiêu AM ép tiến độ):
                  </span>
                  <strong className="text-blue-700">
                    {selectedContract.amTargetMandays} MD
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    3. Estimate (Dự toán kỹ thuật + Bàn giao):
                  </span>
                  <strong className="text-violet-700">
                    {metrics.totalMilestoneEstimateMd} MD
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    4. Real (Thực tế tiêu hao):
                  </span>
                  <strong>{selectedContract.actualConsumedMandays} MD</strong>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">
                    Mandays dôi dư (Limit − Real):
                  </span>
                  <strong
                    className={
                      metrics.isProfitable ? "text-emerald-700" : "text-red-600"
                    }
                  >
                    {metrics.surplusMandays > 0
                      ? `+${metrics.surplusMandays} MD (${formatMoney(metrics.surplusValueVnd)})`
                      : `${metrics.surplusMandays} MD (Âm ${formatMoney(metrics.overBudgetLossVnd)})`}
                  </strong>
                </div>
              </div>

              {metrics.isProfitable ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Tỉ lệ phân bổ thưởng dôi dư (Chuẩn Sếp: 50% Bù rủi ro / 50% Chia thưởng):
                      </span>
                      <span className="font-semibold">
                        {selectedContract.kpiBonusSplitPercent}%
                      </span>
                    </div>
                    <Slider
                      min={40}
                      max={50}
                      step={5}
                      value={[selectedContract.kpiBonusSplitPercent]}
                      onValueChange={(vals) =>
                        updateKpiSplitPercent(selectedContract.id, vals[0] ?? 50)
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
                      <div className="text-emerald-900 font-medium">
                        50% Chia thưởng (Lead/PM, Dev, Sale/AM)
                      </div>
                      <div className="text-base font-bold text-emerald-700 mt-1">
                        +{metrics.bonusSplitMandays} MD (
                        {formatMoney(metrics.kpiBonusAmountVnd)})
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Chia trực tiếp hoặc dồn KPI / lương tháng 13
                      </div>
                    </div>
                    <div className="rounded-lg border p-3 bg-slate-50/60">
                      <div className="text-foreground font-medium">
                        50% Giữ lại bù rủi ro & bảo trì
                      </div>
                      <div className="text-base font-bold text-foreground mt-1">
                        +{metrics.riskReserveMandays} MD (
                        {formatMoney(metrics.maintenanceAndCompanyFundVnd)})
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Bù rủi ro cho các mốc sau / quỹ bảo trì
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-red-600 leading-relaxed">
                  Dự án vượt Hạn mức Limit ({metrics.surplusMandays} MD). Không xét thưởng dôi dư (0đ), khấu trừ{" "}
                  <strong>{formatMoney(metrics.overBudgetLossVnd)}</strong> vào Quỹ dự phòng rủi ro.
                </p>
              )}

              <Button
                size="lg"
                disabled={!metrics.canCloseProject || selectedContract.phase === "CLOSED"}
                onClick={() => closeProjectAndSettleKpi(selectedContract.id)}
                className="w-full gap-2 text-xs font-semibold"
              >
                {selectedContract.phase === "CLOSED" ? (
                  <>
                    <IconCheck className="size-4" />
                    Đã Đóng Dự Án & Quyết Toán Thưởng Dôi Dư
                  </>
                ) : metrics.canCloseProject ? (
                  <>
                    <IconLockOpen className="size-4" />
                    Close Project & Chốt Quỹ Thưởng 50/50
                  </>
                ) : (
                  <>
                    <IconLock className="size-4" />
                    Cần hoàn tất đủ 4 điều kiện để Close Project
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Bắt buộc nhập Số hóa đơn VAT + Link/File Hóa đơn VAT đã xuất */}
      <Dialog
        open={!!issuingVatInstallment}
        onOpenChange={(o) => !o && setIssuingVatInstallment(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Xác Nhận Đã Xuất Hóa Đơn VAT</DialogTitle>
            <DialogDescription className="text-xs">
              Bắt buộc nhập đầy đủ Số hóa đơn VAT và đính kèm Link/File Hóa đơn VAT đã xuất của đợt thanh toán này để mở khóa điều kiện đóng dự án.
            </DialogDescription>
          </DialogHeader>
          {issuingVatInstallment && (
            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-md bg-slate-50 border p-3">
                <div className="font-semibold text-foreground">
                  {issuingVatInstallment.name}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  Giá trị đợt:{" "}
                  <strong>{formatMoney(issuingVatInstallment.amount)}</strong>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Số hóa đơn VAT (*)</Label>
                <Input
                  value={vatInvoiceNumberDraft}
                  onChange={(e) => setVatInvoiceNumberDraft(e.target.value)}
                  placeholder="VD: 0001602"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">
                  File Hóa đơn VAT (PDF/XML) lưu trữ trên hệ thống (*)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={vatInvoiceUrlDraft}
                    onChange={(e) => setVatInvoiceUrlDraft(e.target.value)}
                    placeholder="Tên file PDF hóa đơn..."
                    className="h-9 text-xs flex-1"
                  />
                  <input
                    ref={vatFileInputRef}
                    type="file"
                    accept=".pdf,.xml,.png,.jpg"
                    className="hidden"
                    onChange={handleVatFileSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs gap-1.5 shrink-0"
                    onClick={() => vatFileInputRef.current?.click()}
                  >
                    <IconUpload className="size-3.5" />
                    Chọn file từ máy
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIssuingVatInstallment(null)}
            >
              Hủy
            </Button>
            <Button onClick={handleConfirmIssueVat}>
              Lưu Số HĐ & Xác nhận Đã xuất
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Phiếu Kế toán ngoài */}
      <Dialog open={accountantModalOpen} onOpenChange={setAccountantModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Phiếu Yêu Cầu Xuất Hóa Đơn VAT</DialogTitle>
          </DialogHeader>
          <pre className="rounded-lg border bg-slate-950 text-slate-50 p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
            {accountantBriefText}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountantModalOpen(false)}>
              Đóng
            </Button>
            <Button
              onClick={() => {
                navigator.clipboard?.writeText(accountantBriefText)
                toast.success("Đã copy phiếu yêu cầu xuất hóa đơn!")
              }}
              className="gap-1.5"
            >
              <IconCopy className="size-4" />
              Copy gửi Kế toán
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
