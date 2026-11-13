"use client"

import * as React from "react"
import {
  IconArrowLeft,
  IconBrandGoogleDrive,
  IconCheck,
  IconChecklist,
  IconDeviceFloppy,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconFileText,
  IconLink,
  IconLock,
  IconPlayerPlay,
  IconPlus,
  IconShieldCheck,
  IconTrash,
  IconUpload,
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
  calculateTaxBreakdownFromItems,
  ContractProject,
  evaluateKickoffChecklist,
  getMilestoneFourMetrics,
  InvoiceMethod,
  PreKickoffChecklist,
  ProjectDocCategory,
  ProjectDocument,
  VatCategory,
} from "@/lib/mock/am-types"

const DOC_CATEGORY_LABELS: Record<ProjectDocCategory, string> = {
  CONTRACT_SCAN: "Bản scan Hợp đồng",
  SCOPE_SRS: "Phụ lục Scope / SRS",
  CLIENT_INPUT: "Tài liệu khách gửi",
  OTHER: "Hồ sơ khác",
}

const PIC_OPTIONS = [
  "Anh Du (Lead Foundation)",
  "Chị Giang (PM Tổng)",
  "Anh Thanh (Phụ trách Đào tạo & UAT)",
  "Minh Quân (Tech PM)",
  "Hoàng Nam (Tech PM)",
]

interface DraftScopeRow {
  id: string
  code: string
  title: string
  ownerPic: string
  dueDate: string
  amountBeforeVat: number
  vatCategory: VatCategory
  limitMandays: number
  targetMandays: number
  estimatedMandays: number
  handoverEstimatedMandays: number
}

interface DraftInstallmentRow {
  id: string
  name: string
  percentage: number
  dueDate: string
  linkedMilestoneId: string
  triggerMilestoneName: string
}

interface PreProjectSetupViewProps {
  mode?: "create" | "detail"
}

export function PreProjectSetupView({ mode = "detail" }: PreProjectSetupViewProps) {
  const {
    customers,
    contracts,
    selectedContract,
    roleView,
    hidePrice,
    togglePriceVisible,
    formatMoney,
    setActiveScreen,
    setActiveDetailTab,
    createCustomer,
    createContract,
    addScopeItem,
    updateScopeItem,
    removeScopeItem,
    updateInstallment,
    addInstallment,
    removeInstallment,
    addContractDocument,
    removeContractDocument,
    approveKickoffByBod,
    updateKickoffChecklist,
    updateTargetMandays,
    updateContractPhase,
  } = useAmPrototype()

  const isCreateMode = mode === "create"
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isEditingScope, setIsEditingScope] = React.useState(false)
  const [isEditingSchedule, setIsEditingSchedule] = React.useState(false)

  const [newCustomerModalOpen, setNewCustomerModalOpen] = React.useState(false)
  const [newCustName, setNewCustName] = React.useState("")
  const [newCustTax, setNewCustTax] = React.useState("")
  const [newCustTechName, setNewCustTechName] = React.useState("")
  const [newCustAccEmail, setNewCustAccEmail] = React.useState("")

  // State cho chế độ Create New Contract
  const [customerId, setCustomerId] = React.useState<string>(customers[0]?.id || "cust-01")
  const [contractCode, setContractCode] = React.useState("HĐ-2026-112/DX-AI")
  const [contractName, setContractName] = React.useState(
    "HĐ Xây dựng Chatbot AI Tư vấn Pháp lý & Giỏ hàng BĐS"
  )
  const [pmOwner, setPmOwner] = React.useState("Chị Giang (PM Tổng)")
  const [startDate, setStartDate] = React.useState("2026-11-01")
  const [expectedEndDate, setExpectedEndDate] = React.useState("2027-01-30")
  const [googleDriveUrlDraft, setGoogleDriveUrlDraft] = React.useState(
    "https://drive.google.com/drive/folders/1DX-AI-Chatbot-2026"
  )

  // Checklist 4 điều kiện trước khi Kick-off (Create Mode)
  const [draftChecklist, setDraftChecklist] = React.useState<PreKickoffChecklist>({
    driveRootCreated: true,
    driveTeamDocCreated: true,
    driveSharedDocCreated: true,
    drivePermissionsGranted: true,
    pmConfirmedScope: true,
    kickoffTimelineConfirmed: true,
    kickoffDate: "2026-11-01",
    handoverEstimateConfirmed: true,
    handoverEstimateMandays: 5,
  })

  // Tài liệu lưu trữ trực tiếp trên hệ thống (Create Mode)
  const [uploadCategory, setUploadCategory] =
    React.useState<ProjectDocCategory>("CONTRACT_SCAN")
  const [draftDocs, setDraftDocs] = React.useState<ProjectDocument[]>([
    {
      id: "doc-init-1",
      fileName: "Hop-dong-kinh-te-DX-AI-signed.pdf",
      fileSize: "2.4 MB",
      category: "CONTRACT_SCAN",
      uploadedAt: "2026-10-28",
      uploadedBy: "Thảo (AM)",
    },
    {
      id: "doc-init-2",
      fileName: "Phu-luc-01-Danh-muc-tinh-nang-SRS.pdf",
      fileSize: "1.8 MB",
      category: "SCOPE_SRS",
      uploadedAt: "2026-10-28",
      uploadedBy: "Thảo (AM)",
    },
  ])

  // Tài chính & Credit (Create Mode)
  const [fixedCostAllocation, setFixedCostAllocation] = React.useState<number>(65_000_000)
  const [salesCommissionAmount, setSalesCommissionAmount] = React.useState<number>(45_000_000)
  const [riskReservePercent, setRiskReservePercent] = React.useState<number>(25)
  const [standardMandayRate, setStandardMandayRate] = React.useState<number>(2_500_000)
  const [bufferCompressionPercent, setBufferCompressionPercent] = React.useState<number>(80)
  const [invoiceMethod] = React.useState<InvoiceMethod>("BY_INSTALLMENT")

  // Danh mục MỐC BÀN GIAO KỸ THUẬT (Scope Milestones - có PIC riêng & đủ Limit / Target / Estimate)
  const [scopeRows, setScopeRows] = React.useState<DraftScopeRow[]>([
    {
      id: "s-1",
      code: "MỐC-01",
      title: "Mốc 1 (Foundation): Huấn luyện dữ liệu pháp lý & Vector DB Core",
      ownerPic: "Anh Du (Lead Foundation)",
      dueDate: "2026-11-25",
      amountBeforeVat: 220_000_000,
      vatCategory: "NON_VAT",
      limitMandays: 30,
      targetMandays: 24,
      estimatedMandays: 25,
      handoverEstimatedMandays: 1,
    },
    {
      id: "s-2",
      code: "MỐC-02",
      title: "Mốc 2 (Core): Tích hợp Chatbot vào Zalo OA, Fanpage và App Sale",
      ownerPic: "Chị Giang (PM Tổng)",
      dueDate: "2026-12-25",
      amountBeforeVat: 180_000_000,
      vatCategory: "NON_VAT",
      limitMandays: 25,
      targetMandays: 20,
      estimatedMandays: 21,
      handoverEstimatedMandays: 1,
    },
    {
      id: "s-3",
      code: "MỐC-03",
      title: "Mốc 3 (Đào tạo & Bàn giao): Đào tạo UAT, Hướng dẫn vận hành & Nghiệm thu",
      ownerPic: "Anh Thanh (Phụ trách Đào tạo & UAT)",
      dueDate: "2027-01-25",
      amountBeforeVat: 100_000_000,
      vatCategory: "VAT_10",
      limitMandays: 15,
      targetMandays: 12,
      estimatedMandays: 13,
      handoverEstimatedMandays: 4,
    },
  ])

  // Lộ trình ĐỢT THANH TOÁN (Payment Tranches - độc lập nhưng liên kết với Mốc bàn giao)
  const [installments, setInstallments] = React.useState<DraftInstallmentRow[]>([
    {
      id: "d-1",
      name: "Đợt 1: Tạm ứng ngay sau khi ký HĐ (30%)",
      percentage: 30,
      dueDate: "2026-11-05",
      linkedMilestoneId: "s-1",
      triggerMilestoneName: "Ký Hợp đồng & Hoàn tất Checklist Kick-off",
    },
    {
      id: "d-2",
      name: "Đợt 2: Thanh toán khi hoàn thành Mốc 1 - Foundation (30%)",
      percentage: 30,
      dueDate: "2026-11-28",
      linkedMilestoneId: "s-1",
      triggerMilestoneName: "Hoàn thành Mốc 1: Foundation",
    },
    {
      id: "d-3",
      name: "Đợt 3: Thanh toán khi hoàn thành Mốc 2 - Core (20%)",
      percentage: 20,
      dueDate: "2026-12-28",
      linkedMilestoneId: "s-2",
      triggerMilestoneName: "Hoàn thành Mốc 2: Core Chatbot",
    },
    {
      id: "d-4",
      name: "Đợt 4: Tất toán khi hoàn thành Mốc 3 - Đào tạo & Nghiệm thu (20%)",
      percentage: 20,
      dueDate: "2027-01-30",
      linkedMilestoneId: "s-3",
      triggerMilestoneName: "Hoàn thành Mốc 3: Đào tạo & Bàn giao",
    },
  ])

  const activeContract = isCreateMode ? null : selectedContract
  const detailMetrics = activeContract ? calculateContractMetrics(activeContract) : null
  const kickoffEval = activeContract ? evaluateKickoffChecklist(activeContract) : null

  const effectiveCustomerId = activeContract ? activeContract.customerId : customerId
  const selectedCustomerObj = React.useMemo(
    () => customers.find((c) => c.id === effectiveCustomerId) || customers[0],
    [customers, effectiveCustomerId]
  )

  const displayedDocuments: ProjectDocument[] = React.useMemo(() => {
    if (isCreateMode) return draftDocs
    if (activeContract?.documents && activeContract.documents.length > 0) {
      return activeContract.documents
    }
    if (!activeContract) return []
    return [
      {
        id: `default-doc-1-${activeContract.id}`,
        fileName: `${activeContract.contractCode.replace(/\//g, "-")}-Ban-scan-HD.pdf`,
        fileSize: "3.1 MB",
        category: "CONTRACT_SCAN",
        uploadedAt: activeContract.signedDate,
        uploadedBy: "Thảo (AM)",
      },
      {
        id: `default-doc-2-${activeContract.id}`,
        fileName: `${activeContract.contractCode.replace(/\//g, "-")}-Phu-luc-Scope-SRS.pdf`,
        fileSize: "1.9 MB",
        category: "SCOPE_SRS",
        uploadedAt: activeContract.signedDate,
        uploadedBy: "Thảo (AM)",
      },
    ]
  }, [isCreateMode, draftDocs, activeContract])

  const createTaxBreakdown = React.useMemo(
    () => calculateTaxBreakdownFromItems(scopeRows),
    [scopeRows]
  )

  const baseContractValue = isCreateMode
    ? createTaxBreakdown.grandTotalWithTax
    : activeContract?.baseContractValue || 0

  const effectiveRate = isCreateMode
    ? standardMandayRate
    : activeContract?.standardMandayRate || 2_500_000

  const effectiveFixedCost = isCreateMode
    ? fixedCostAllocation
    : activeContract?.fixedCostAllocation || 0

  const effectiveSalesComm = isCreateMode
    ? salesCommissionAmount
    : activeContract?.salesCommissionAmount || 0

  const effectiveRiskPercent = isCreateMode
    ? riskReservePercent
    : activeContract?.riskReservePercent || 25

  const riskReserveAmount = Math.round((baseContractValue * effectiveRiskPercent) / 100)
  const creditY = Math.max(
    0,
    baseContractValue - (effectiveFixedCost + effectiveSalesComm + riskReserveAmount)
  )

  const displayedScopeRows: DraftScopeRow[] = isCreateMode
    ? scopeRows
    : (activeContract?.scopeItems || []).map((s) => {
        const m4 = getMilestoneFourMetrics(s, activeContract!)
        return {
          id: s.id,
          code: s.code,
          title: s.title,
          ownerPic: s.ownerPic || activeContract?.pmOwner || "Chị Giang (PM Tổng)",
          dueDate: s.dueDate || activeContract?.expectedEndDate || "",
          amountBeforeVat: s.amountBeforeVat,
          vatCategory: s.vatCategory,
          limitMandays: m4.limitMandays,
          targetMandays: m4.targetMandays,
          estimatedMandays: m4.estimateMandays,
          handoverEstimatedMandays: s.handoverEstimatedMandays ?? 2,
        }
      })

  const displayedTaxBreakdown = React.useMemo(
    () => calculateTaxBreakdownFromItems(displayedScopeRows),
    [displayedScopeRows]
  )

  const totalScopeLimitMd = displayedScopeRows.reduce(
    (s, r) => s + Number(r.limitMandays || 0),
    0
  )
  const totalScopeTargetMd = displayedScopeRows.reduce(
    (s, r) => s + Number(r.targetMandays || 0),
    0
  )
  const totalScopeEstimatedMd = displayedScopeRows.reduce(
    (s, r) => s + Number(r.estimatedMandays || 0),
    0
  )
  const totalHandoverEstimatedMd = displayedScopeRows.reduce(
    (s, r) => s + Number(r.handoverEstimatedMandays || 0),
    0
  )

  const maxMandays = isCreateMode
    ? totalScopeLimitMd || (effectiveRate > 0 ? Math.floor(creditY / effectiveRate) : 0)
    : detailMetrics?.totalMaxMandays || 0

  const amTargetMandays = isCreateMode
    ? totalScopeTargetMd || Math.max(1, Math.round((maxMandays * bufferCompressionPercent) / 100))
    : detailMetrics?.effectiveTargetMandays || activeContract?.amTargetMandays || 0

  const amBufferMandays = Math.max(0, maxMandays - amTargetMandays)

  const totalInstallmentPercent = isCreateMode
    ? installments.reduce((sum, i) => sum + Number(i.percentage || 0), 0)
    : (activeContract?.installments || []).reduce(
        (sum, i) => sum + Number(i.percentage || 0),
        0
      )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const sizeMb = `${Math.max(0.1, file.size / (1024 * 1024)).toFixed(1)} MB`

    if (isCreateMode) {
      setDraftDocs((prev) => [
        ...prev,
        {
          id: `doc-${Date.now()}`,
          fileName: file.name,
          fileSize: sizeMb,
          category: uploadCategory,
          uploadedAt: new Date().toISOString().slice(0, 10),
          uploadedBy: "Thảo (AM)",
        },
      ])
      toast.success(`Đã tải tài liệu "${file.name}" lên hệ thống!`)
    } else if (activeContract) {
      addContractDocument(activeContract.id, {
        fileName: file.name,
        fileSize: sizeMb,
        category: uploadCategory,
        uploadedBy: "Thảo (AM)",
      })
    }
    e.target.value = ""
  }

  const handleRemoveDoc = (docId: string) => {
    if (isCreateMode) {
      setDraftDocs((prev) => prev.filter((d) => d.id !== docId))
    } else if (activeContract) {
      removeContractDocument(activeContract.id, docId)
    }
  }

  const handleAddScopeRow = () => {
    if (isCreateMode) {
      const nextIdx = scopeRows.length + 1
      setScopeRows([
        ...scopeRows,
        {
          id: `s-${Date.now()}`,
          code: `MỐC-0${nextIdx}`,
          title: `Mốc ${nextIdx}: Hạng mục bàn giao kỹ thuật #${nextIdx}`,
          ownerPic: "Chị Giang (PM Tổng)",
          dueDate: expectedEndDate,
          amountBeforeVat: 50_000_000,
          vatCategory: "NON_VAT",
          limitMandays: 15,
          targetMandays: 12,
          estimatedMandays: 12,
          handoverEstimatedMandays: 2,
        },
      ])
    } else if (activeContract) {
      const nextIdx = activeContract.scopeItems.length + 1
      addScopeItem(activeContract.id, {
        code: `MỐC-0${nextIdx}`,
        title: `Mốc ${nextIdx}: Hạng mục bàn giao kỹ thuật #${nextIdx}`,
        moduleName: "Core",
        ownerPic: activeContract.pmOwner,
        description: `Mốc ${nextIdx}: Hạng mục bàn giao kỹ thuật #${nextIdx}`,
        source: "BASELINE",
        dueDate: activeContract.expectedEndDate,
        status: "NOT_STARTED",
        progressPercent: 0,
        amountBeforeVat: 50_000_000,
        vatCategory: "NON_VAT",
        limitMandays: 15,
        targetMandays: 12,
        estimatedMandays: 12,
        handoverEstimatedMandays: 2,
        actualMandays: 0,
        isAccepted: false,
      })
      setIsEditingScope(true)
    }
  }

  const handleAddInstallmentRow = () => {
    const currentSum = totalInstallmentPercent
    const suggestedRemaining = Math.max(0, 100 - currentSum)

    if (isCreateMode) {
      const nextIndex = installments.length + 1
      setInstallments([
        ...installments,
        {
          id: `d-${Date.now()}`,
          name: `Đợt ${nextIndex}: Thanh toán theo tiến độ dòng tiền`,
          percentage: suggestedRemaining || 20,
          dueDate: expectedEndDate,
          linkedMilestoneId: scopeRows[0]?.id || "",
          triggerMilestoneName: `Hoàn thành Mốc liên kết đợt ${nextIndex}`,
        },
      ])
    } else if (activeContract) {
      const nextIndex = activeContract.installments.length + 1
      const pct = suggestedRemaining || 20
      const amt = Math.round((activeContract.baseContractValue * pct) / 100)
      const vatAmt = Math.round((activeContract.vatPortionAmount * pct) / 100)
      addInstallment(activeContract.id, {
        name: `Đợt ${nextIndex}: Thanh toán theo tiến độ dòng tiền`,
        percentage: pct,
        amount: amt,
        vatAmount: vatAmt,
        nonVatAmount: amt - vatAmt,
        dueDate: activeContract.expectedEndDate,
        linkedMilestoneId: activeContract.scopeItems[0]?.id,
        triggerMilestoneName: `Hoàn thành Mốc liên kết đợt ${nextIndex}`,
        paymentStatus: "PENDING",
        vatInvoiceStatus: "NOT_YET",
      })
      setIsEditingSchedule(true)
    }
  }

  const handleQuickCreateCustomer = () => {
    if (!newCustName.trim() || !newCustTax.trim()) {
      toast.error("Vui lòng nhập Tên công ty và Mã số thuế")
      return
    }
    const created = createCustomer({
      code: `KH-${newCustTax.slice(-4)}`,
      companyName: newCustName.trim(),
      taxCode: newCustTax.trim(),
      industry: "Doanh nghiệp",
      address: "TP. Hồ Chí Minh",
      techContact: {
        name: newCustTechName || "Đại diện Kỹ thuật",
        title: "IT Manager",
        phone: "0909 000 111",
        email: "tech@partner.vn",
      },
      accountingContact: {
        name: "Phòng Kế toán",
        title: "Kế toán thanh toán",
        phone: "0909 000 222",
        email: newCustAccEmail || "accounting@partner.vn",
      },
    })
    setCustomerId(created.id)
    setNewCustomerModalOpen(false)
    setNewCustName("")
    setNewCustTax("")
  }

  const handleCreateContractSubmit = () => {
    if (!contractCode.trim() || !contractName.trim()) {
      toast.error("Vui lòng nhập Mã hợp đồng và Tên hợp đồng/dự án")
      return
    }
    if (totalInstallmentPercent !== 100) {
      toast.error(
        `Tổng tỉ lệ các đợt thanh toán đang là ${totalInstallmentPercent}%. Vui lòng điều chỉnh đủ 100%!`
      )
      return
    }

    const totalVal = createTaxBreakdown.grandTotalWithTax
    const taxablePortion =
      createTaxBreakdown.vatBaseTotal + createTaxBreakdown.totalVatTax
    const nonVatPortion = createTaxBreakdown.nonVatTotal

    const newContract: ContractProject = {
      id: `ctr-${Date.now()}`,
      contractCode: contractCode.trim(),
      projectName: contractName.trim(),
      customerId: selectedCustomerObj.id,
      customerName: selectedCustomerObj.companyName,
      signedDate: new Date().toISOString().slice(0, 10),
      startDate,
      expectedEndDate,
      amOwner: "Thảo (AM)",
      pmOwner,
      phase: "PRE_PROJECT",
      amCustomTags: ["Hợp đồng mới"],
      checkCycleDays: 2,
      lastCheckInDate: new Date().toISOString().slice(0, 10),
      kickoffChecklist: {
        ...draftChecklist,
        handoverEstimateMandays: totalHandoverEstimatedMd || draftChecklist.handoverEstimateMandays,
      },
      documents: draftDocs,
      googleDriveUrl: googleDriveUrlDraft,
      drivePermissionsVerified:
        draftChecklist.driveRootCreated &&
        draftChecklist.driveTeamDocCreated &&
        draftChecklist.driveSharedDocCreated &&
        draftChecklist.drivePermissionsGranted,
      bodAllowKickoffWithoutAdvance: false,
      baseContractValue: totalVal,
      approvedUpsellValue: 0,
      fixedCostAllocation,
      salesCommissionAmount,
      riskReservePercent,
      standardMandayRate,
      initialMaxMandays: maxMandays,
      upsellAddedMandays: 0,
      amTargetMandays,
      pmEstimatedMandays: totalScopeEstimatedMd,
      actualConsumedMandays: 0,
      hasVatItems: taxablePortion > 0,
      hasNonVatItems: nonVatPortion > 0,
      vatRatePercent: createTaxBreakdown.vat8Base > 0 ? 8 : 10,
      vatPortionAmount: taxablePortion,
      nonVatPortionAmount: nonVatPortion,
      invoiceMethod,
      externalAccountantNote: `Tự động tách từ bảng Mốc bàn giao.`,
      manualForceRedFlag: false,
      quickActionBlocker:
        "Vừa khởi tạo hợp đồng — Chờ hoàn tất Checklist 4 điều kiện Kick-off & Tạm ứng Đợt 1",
      kpiBonusSplitPercent: 50,
      installments: installments.map((inst, idx) => {
        const amt = Math.round((totalVal * inst.percentage) / 100)
        const vatAmt = Math.round((taxablePortion * inst.percentage) / 100)
        return {
          id: `inst-new-${idx}-${Date.now()}`,
          name: inst.name,
          percentage: inst.percentage,
          amount: amt,
          vatAmount: vatAmt,
          nonVatAmount: amt - vatAmt,
          dueDate: inst.dueDate,
          linkedMilestoneId: inst.linkedMilestoneId,
          triggerMilestoneName: inst.triggerMilestoneName,
          paymentStatus: idx === 0 ? "INVOICED" : "PENDING",
          vatInvoiceStatus: idx === 0 ? "SENT_TO_ACCOUNTANT" : "NOT_YET",
        }
      }),
      scopeItems: scopeRows.map((r, idx) => ({
        id: r.id || `sc-new-${idx}-${Date.now()}`,
        code: r.code || `MỐC-0${idx + 1}`,
        title: r.title || `Mốc bàn giao #${idx + 1}`,
        moduleName: "Core",
        ownerPic: r.ownerPic || pmOwner,
        description: r.title,
        source: "BASELINE",
        dueDate: r.dueDate || expectedEndDate,
        status: "NOT_STARTED",
        progressPercent: 0,
        pmNote: "",
        blockerNote: "",
        amountBeforeVat: Number(r.amountBeforeVat) || 0,
        vatCategory: r.vatCategory,
        limitMandays: Number(r.limitMandays) || 15,
        targetMandays: Number(r.targetMandays) || 12,
        estimatedMandays: Number(r.estimatedMandays) || 12,
        handoverEstimatedMandays: Number(r.handoverEstimatedMandays) || 2,
        actualMandays: 0,
        isAccepted: false,
      })),
      milestones: [],
      checkIns: [],
      changeRequests: [],
      handover: {
        sourceCodeDelivered: false,
        userGuideAndVideoDelivered: false,
        signedAcceptanceScanUploaded: false,
      },
    }

    createContract(newContract)
  }

  const effectiveChecklist: PreKickoffChecklist = isCreateMode
    ? draftChecklist
    : kickoffEval?.checklist || draftChecklist

  const handleToggleChecklistField = (patch: Partial<PreKickoffChecklist>) => {
    if (isCreateMode) {
      setDraftChecklist((prev) => ({ ...prev, ...patch }))
    } else if (activeContract) {
      updateKickoffChecklist(activeContract.id, patch)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header cho chế độ Tạo mới Hợp đồng */}
      {isCreateMode && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setActiveScreen("dashboard")}
            >
              <IconArrowLeft className="size-3.5" />
              Quay lại Danh sách Hợp đồng
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Khởi Tạo Hợp Đồng Mới & Thiết Lập 4 Chỉ Số Milestone Finance
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Phân định rõ Mốc bàn giao kỹ thuật (có PIC riêng + Limit/Target/Estimate) và Đợt thanh toán dòng tiền
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {roleView !== "PM" && (
              <Button
                variant="outline"
                size="sm"
                onClick={togglePriceVisible}
                className="h-9 text-xs gap-1.5"
              >
                {hidePrice ? (
                  <>
                    <IconEye className="size-4 text-primary" />
                    Hiện giá tiền
                  </>
                ) : (
                  <>
                    <IconEyeOff className="size-4 text-muted-foreground" />
                    Ẩn giá tiền (••••)
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={handleCreateContractSubmit}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-white h-9 text-xs"
            >
              <IconDeviceFloppy className="size-4" />
              Lưu Hợp Đồng & Mở Hồ Sơ
            </Button>
          </div>
        </div>
      )}

      {/* MỤC 4 BIÊN BẢN HỌP: CHECKLIST KHỞI TẠO BẮT BUỘC TRƯỚC KHI KICK-OFF DỰ ÁN */}
      <Card
        className={
          !isCreateMode && detailMetrics?.canKickoffToInProject
            ? "shadow-none border-emerald-300 bg-emerald-50/40"
            : "shadow-none border-amber-300 bg-amber-50/40"
        }
      >
        <CardHeader className="pb-3 border-b bg-white/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <IconChecklist className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold">
                  Checklist Điều Kiện Bắt Buộc Trước Khi Start Dự Án (Pre-Kickoff Gatekeeper)
                </CardTitle>
                {!isCreateMode && kickoffEval && (
                  <Badge
                    className={
                      kickoffEval.isAllChecklistReady
                        ? "bg-emerald-600 text-white border-0 text-[10px]"
                        : "bg-amber-600 text-white border-0 text-[10px]"
                    }
                  >
                    Đã đạt {kickoffEval.completedCount}/4 nhóm điều kiện
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Trước khi bấm <strong>Start dự án</strong> hoặc <strong>Start mốc mới</strong>, AM Thảo bắt buộc kiểm tra đủ 4 nhóm điều kiện dưới đây (Đặc biệt: Cấu trúc 3 thư mục Google Drive & Dự toán thời gian bàn giao Handover).
              </p>
            </div>

            {!isCreateMode && activeContract && detailMetrics && (
              <div className="flex flex-wrap items-center gap-2">
                {!detailMetrics.isFirstInstallmentPaid &&
                  activeContract.installments[0] &&
                  roleView !== "PM" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-emerald-300 text-emerald-700 bg-white hover:bg-emerald-50 gap-1"
                      onClick={() =>
                        updateInstallment(
                          activeContract.id,
                          activeContract.installments[0].id,
                          {
                            paymentStatus: "PAID",
                            paidDate: new Date().toISOString().slice(0, 10),
                          }
                        )
                      }
                    >
                      <IconCheck className="size-3.5" />
                      1. Xác nhận Đã thu Tạm ứng Đợt 1
                    </Button>
                  )}

                {!detailMetrics.isFirstInstallmentPaid &&
                  !activeContract.bodAllowKickoffWithoutAdvance &&
                  roleView === "BOD" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-amber-400 text-amber-900 bg-white hover:bg-amber-100 gap-1"
                      onClick={() => approveKickoffByBod(activeContract.id)}
                    >
                      <IconShieldCheck className="size-3.5" />
                      BOD duyệt ngoại lệ Tạm ứng
                    </Button>
                  )}

                {activeContract.phase === "PRE_PROJECT" && (
                  <Button
                    size="sm"
                    disabled={!detailMetrics.canKickoffToInProject}
                    onClick={() => {
                      updateContractPhase(activeContract.id, "IN_PROJECT")
                      setActiveDetailTab("in-project")
                    }}
                    className="h-8 text-xs gap-1.5"
                  >
                    {detailMetrics.canKickoffToInProject ? (
                      <>
                        <IconPlayerPlay className="size-3.5" />
                        Start Dự Án (Kick-off sang In-Project)
                      </>
                    ) : (
                      <>
                        <IconLock className="size-3.5" />
                        Chưa đủ Checklist 4 mục & Tạm ứng Đợt 1
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Điều kiện 1: Check Google Drive (3 thư mục con + phân quyền) */}
          <div className="rounded-lg border bg-white p-3.5 space-y-2">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <IconBrandGoogleDrive className="size-4 text-emerald-600" />
              <span>1. Check Google Drive (3 Thư mục)</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={effectiveChecklist.driveRootCreated}
                  onCheckedChange={(v) =>
                    handleToggleChecklistField({ driveRootCreated: Boolean(v) })
                  }
                />
                <span>[Folder 1] Đã tạo Thư mục gốc Hợp đồng</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={effectiveChecklist.driveTeamDocCreated}
                  onCheckedChange={(v) =>
                    handleToggleChecklistField({
                      driveTeamDocCreated: Boolean(v),
                    })
                  }
                />
                <span>[Folder 2] Thư mục nội bộ (Team Document)</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={effectiveChecklist.driveSharedDocCreated}
                  onCheckedChange={(v) =>
                    handleToggleChecklistField({
                      driveSharedDocCreated: Boolean(v),
                    })
                  }
                />
                <span>[Folder 3] Thư mục chia sẻ khách (Shared Document)</span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer pt-1 border-t font-medium text-primary">
                <Checkbox
                  checked={effectiveChecklist.drivePermissionsGranted}
                  onCheckedChange={(v) =>
                    handleToggleChecklistField({
                      drivePermissionsGranted: Boolean(v),
                    })
                  }
                />
                <span>Đã phân quyền chuẩn cho AM, PM, Dev & Khách</span>
              </label>
            </div>
          </div>

          {/* Điều kiện 2: Project Document (Yêu cầu nghiệp vụ) */}
          <div className="rounded-lg border bg-white p-3.5 space-y-2 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-semibold text-foreground">
                2. Project Document (Yêu cầu nghiệp vụ)
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Tài liệu SRS / Scope chi tiết đã được gửi vào Team Document và PM phụ trách xác nhận đã đọc hiểu đúng 100% phạm vi.
              </p>
            </div>
            <label className="flex items-center gap-2 rounded border bg-slate-50 p-2.5 cursor-pointer font-medium">
              <Checkbox
                checked={effectiveChecklist.pmConfirmedScope}
                onCheckedChange={(v) =>
                  handleToggleChecklistField({ pmConfirmedScope: Boolean(v) })
                }
              />
              <span>PM đã xác nhận hiểu đúng Scope dự án</span>
            </label>
          </div>

          {/* Điều kiện 3: Timeline chuẩn & Lịch Kick-off */}
          <div className="rounded-lg border bg-white p-3.5 space-y-2 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="font-semibold text-foreground">
                3. Timeline Chuẩn & Lịch Kick-off
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground block">
                  Ngày họp Kick-off với khách:
                </span>
                <Input
                  type="date"
                  value={effectiveChecklist.kickoffDate || startDate}
                  onChange={(e) =>
                    handleToggleChecklistField({ kickoffDate: e.target.value })
                  }
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 rounded border bg-slate-50 p-2.5 cursor-pointer font-medium">
              <Checkbox
                checked={effectiveChecklist.kickoffTimelineConfirmed}
                onCheckedChange={(v) =>
                  handleToggleChecklistField({
                    kickoffTimelineConfirmed: Boolean(v),
                  })
                }
              />
              <span>Đã có lịch Kick-off & Chốt Scope với khách</span>
            </label>
          </div>

          {/* Điều kiện 4: Ước tính phần Bàn giao (Handover Estimate) */}
          <div className="rounded-lg border bg-white p-3.5 space-y-2 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="font-semibold text-foreground">
                4. Ước Tính Phần Bàn Giao (Handover Estimate)
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Bắt buộc PM phải tính cả thời gian bàn giao, họp nghiệm thu & hướng dẫn sử dụng (tránh mất cả tuần không tên gây trễ dự án).
              </p>
              <div className="flex items-center justify-between rounded bg-amber-50/80 border border-amber-200 px-2.5 py-1 text-[11px]">
                <span>Tổng MD Bàn giao trong các Mốc:</span>
                <strong className="text-amber-900">
                  {totalHandoverEstimatedMd} MD
                </strong>
              </div>
            </div>
            <label className="flex items-center gap-2 rounded border bg-slate-50 p-2.5 cursor-pointer font-medium">
              <Checkbox
                checked={effectiveChecklist.handoverEstimateConfirmed}
                onCheckedChange={(v) =>
                  handleToggleChecklistField({
                    handoverEstimateConfirmed: Boolean(v),
                    handoverEstimateMandays: Math.max(
                      2,
                      totalHandoverEstimatedMd || 3
                    ),
                  })
                }
              />
              <span>PM đã cộng đủ thời gian Bàn giao / HDSD</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Bố cục 2 cột thoáng đãng */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Cột trái (7 phần): Thông tin Hợp đồng + Bảng MỐC BÀN GIAO (Scope Milestone) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  1. Định Danh Hợp Đồng, Khách Hàng (1-N) & Lưu Trữ Tài Liệu
                </CardTitle>
                {isCreateMode && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => setNewCustomerModalOpen(true)}
                  >
                    <IconPlus className="size-3.5" />
                    Khách hàng mới
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Khách hàng doanh nghiệp</Label>
                  {isCreateMode ? (
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c) => {
                          const count = contracts.filter((ctr) => ctr.customerId === c.id).length
                          return (
                            <SelectItem key={c.id} value={c.id}>
                              {c.companyName} (MST: {c.taxCode} • Đã ký {count} HĐ)
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-9 px-3 rounded-md border bg-slate-50 flex items-center justify-between text-xs font-medium">
                      <span>{selectedCustomerObj.companyName}</span>
                      <span className="text-muted-foreground font-mono">
                        MST: {selectedCustomerObj.taxCode}
                      </span>
                    </div>
                  )}
                </div>

                <div className="rounded-md bg-slate-50 border px-3 py-2 text-xs">
                  <span className="text-muted-foreground block">
                    Đầu mối Kỹ thuật (Duyệt UAT & Nghiệm thu):
                  </span>
                  <strong className="text-foreground">
                    {selectedCustomerObj.techContact.name}
                  </strong>{" "}
                  ({selectedCustomerObj.techContact.phone})
                </div>

                <div className="rounded-md bg-slate-50 border px-3 py-2 text-xs">
                  <span className="text-muted-foreground block">
                    Đầu mối Kế toán (Thanh toán & Nhận HĐ VAT):
                  </span>
                  <strong className="text-foreground">
                    {selectedCustomerObj.accountingContact.name}
                  </strong>{" "}
                  ({selectedCustomerObj.accountingContact.email})
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">
                    Link Thư mục gốc Google Drive (Gồm 3 folder: Gốc HĐ • Team Document • Shared Document)
                  </Label>
                  <Input
                    value={
                      isCreateMode
                        ? googleDriveUrlDraft
                        : activeContract?.googleDriveUrl || ""
                    }
                    readOnly={!isCreateMode}
                    onChange={(e) => setGoogleDriveUrlDraft(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                {isCreateMode && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Mã hợp đồng</Label>
                      <Input
                        value={contractCode}
                        onChange={(e) => setContractCode(e.target.value)}
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">PM Tổng phụ trách toàn dự án</Label>
                      <Select value={pmOwner} onValueChange={setPmOwner}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PIC_OPTIONS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2 space-y-1.5">
                      <Label className="text-xs">Tên Hợp đồng / Dự án</Label>
                      <Input
                        value={contractName}
                        onChange={(e) => setContractName(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </>
                )}

                {/* Lưu trữ tài liệu */}
                <div className="sm:col-span-2 space-y-2.5 pt-2 border-t">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-xs font-semibold">
                      Tài liệu Hợp đồng & SRS lưu trên hệ thống ({displayedDocuments.length} file)
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={uploadCategory}
                        onValueChange={(v) => setUploadCategory(v as ProjectDocCategory)}
                      >
                        <SelectTrigger className="w-40 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CONTRACT_SCAN">Bản scan Hợp đồng</SelectItem>
                          <SelectItem value="SCOPE_SRS">Phụ lục Scope / SRS</SelectItem>
                          <SelectItem value="CLIENT_INPUT">Tài liệu khách gửi</SelectItem>
                          <SelectItem value="OTHER">Hồ sơ khác</SelectItem>
                        </SelectContent>
                      </Select>

                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <IconUpload className="size-3.5" />
                        Tải file
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {displayedDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-3 rounded-md border bg-slate-50/70 px-3 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <IconFileText className="size-4 text-primary shrink-0" />
                          <span className="font-medium text-foreground truncate">
                            {doc.fileName}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0">
                            ({DOC_CATEGORY_LABELS[doc.category]})
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveDoc(doc.id)}
                        >
                          <IconTrash className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. MỐC BÀN GIAO KỸ THUẬT (SCOPE MILESTONES) - Tách biệt rõ với Đợt thanh toán, có Người phụ trách riêng & 4 chỉ số Tài chính */}
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    2. Các Mốc Bàn Giao Kỹ Thuật (Scope Milestones • Có Người Phụ Trách Riêng)
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Chia theo module kỹ thuật (Foundation, Core, Đào tạo/UAT). Mỗi mốc có Người phụ trách (PIC) riêng và bộ chỉ số <strong>Limit • Target • Estimate (gồm Bàn giao)</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!isCreateMode && roleView !== "PM" && (
                    <Button
                      size="sm"
                      variant={isEditingScope ? "default" : "outline"}
                      className="h-7 text-xs gap-1"
                      onClick={() => setIsEditingScope((prev) => !prev)}
                    >
                      <IconEdit className="size-3.5" />
                      {isEditingScope ? "Xong" : "Chỉnh sửa Mốc"}
                    </Button>
                  )}
                  {(isCreateMode || roleView !== "PM") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={handleAddScopeRow}
                    >
                      <IconPlus className="size-3.5" />
                      Thêm Mốc bàn giao
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="w-[75px] pl-4 text-xs">Mã Mốc</TableHead>
                    <TableHead className="text-xs">Mốc bàn giao & Người phụ trách (PIC)</TableHead>
                    {roleView !== "PM" && (
                      <TableHead className="w-[115px] text-xs">
                        Phân bổ tiền
                      </TableHead>
                    )}
                    {roleView !== "PM" && (
                      <TableHead className="w-[65px] text-center text-xs">
                        Limit
                      </TableHead>
                    )}
                    <TableHead className="w-[65px] text-center text-xs text-primary">
                      Target
                    </TableHead>
                    <TableHead className="w-[85px] text-center text-xs">
                      Est (Gồm BG)
                    </TableHead>
                    {(isCreateMode || isEditingScope) && <TableHead className="w-[36px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedScopeRows.map((row, idx) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-4 font-mono text-xs align-top py-3">
                        <div className="font-semibold">{row.code}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {row.dueDate}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs whitespace-normal align-top py-3">
                        {isCreateMode || isEditingScope ? (
                          <div className="space-y-1.5">
                            <Input
                              value={row.title}
                              onChange={(e) => {
                                if (isCreateMode) {
                                  const next = [...scopeRows]
                                  next[idx] = { ...row, title: e.target.value }
                                  setScopeRows(next)
                                } else if (activeContract) {
                                  updateScopeItem(activeContract.id, row.id, {
                                    title: e.target.value,
                                  })
                                }
                              }}
                              className="h-7 text-xs"
                            />
                            <div className="flex items-center gap-2">
                              <Select
                                value={row.ownerPic}
                                onValueChange={(v) => {
                                  if (isCreateMode) {
                                    const next = [...scopeRows]
                                    next[idx] = { ...row, ownerPic: v }
                                    setScopeRows(next)
                                  } else if (activeContract) {
                                    updateScopeItem(activeContract.id, row.id, {
                                      ownerPic: v,
                                    })
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-[11px] w-56">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PIC_OPTIONS.map((p) => (
                                    <SelectItem key={p} value={p}>
                                      {p}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="date"
                                value={row.dueDate}
                                onChange={(e) => {
                                  if (isCreateMode) {
                                    const next = [...scopeRows]
                                    next[idx] = { ...row, dueDate: e.target.value }
                                    setScopeRows(next)
                                  } else if (activeContract) {
                                    updateScopeItem(activeContract.id, row.id, {
                                      dueDate: e.target.value,
                                    })
                                  }
                                }}
                                className="h-7 text-[11px] w-36"
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-foreground">
                              {row.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1 text-primary font-medium">
                                <IconUserCheck className="size-3" />
                                PIC: {row.ownerPic}
                              </span>
                              <span>•</span>
                              <span>
                                Thuế:{" "}
                                {row.vatCategory === "NON_VAT"
                                  ? "Không VAT"
                                  : row.vatCategory === "VAT_8"
                                  ? "VAT 8%"
                                  : "VAT 10%"}
                              </span>
                            </div>
                          </div>
                        )}
                      </TableCell>

                      {roleView !== "PM" && (
                        <TableCell className="text-xs font-medium align-top py-3">
                          {isCreateMode || isEditingScope ? (
                            <Input
                              type="number"
                              step={10_000_000}
                              value={row.amountBeforeVat}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0
                                if (isCreateMode) {
                                  const next = [...scopeRows]
                                  next[idx] = { ...row, amountBeforeVat: val }
                                  setScopeRows(next)
                                } else if (activeContract) {
                                  updateScopeItem(activeContract.id, row.id, {
                                    amountBeforeVat: val,
                                  })
                                }
                              }}
                              className="h-7 text-xs"
                            />
                          ) : (
                            formatMoney(row.amountBeforeVat)
                          )}
                        </TableCell>
                      )}

                      {/* 1. Limit MD */}
                      {roleView !== "PM" && (
                        <TableCell className="text-center text-xs font-bold align-top py-3">
                          {isCreateMode || isEditingScope ? (
                            <Input
                              type="number"
                              value={row.limitMandays}
                              onChange={(e) => {
                                const md = Number(e.target.value) || 0
                                if (isCreateMode) {
                                  const next = [...scopeRows]
                                  next[idx] = { ...row, limitMandays: md }
                                  setScopeRows(next)
                                } else if (activeContract) {
                                  updateScopeItem(activeContract.id, row.id, {
                                    limitMandays: md,
                                  })
                                }
                              }}
                              className="h-7 text-xs text-center"
                            />
                          ) : (
                            `${row.limitMandays} MD`
                          )}
                        </TableCell>
                      )}

                      {/* 2. Target MD */}
                      <TableCell className="text-center text-xs font-bold text-primary align-top py-3">
                        {isCreateMode || isEditingScope ? (
                          <Input
                            type="number"
                            value={row.targetMandays}
                            onChange={(e) => {
                              const md = Number(e.target.value) || 0
                              if (isCreateMode) {
                                const next = [...scopeRows]
                                next[idx] = { ...row, targetMandays: md }
                                setScopeRows(next)
                              } else if (activeContract) {
                                updateScopeItem(activeContract.id, row.id, {
                                  targetMandays: md,
                                })
                              }
                            }}
                            className="h-7 text-xs text-center"
                          />
                        ) : (
                          `${row.targetMandays} MD`
                        )}
                      </TableCell>

                      {/* 3. Estimate MD (gồm cả Handover MD) */}
                      <TableCell className="text-center text-xs align-top py-3">
                        {isCreateMode || isEditingScope ? (
                          <div className="space-y-1">
                            <Input
                              type="number"
                              value={row.estimatedMandays}
                              onChange={(e) => {
                                const md = Number(e.target.value) || 0
                                if (isCreateMode) {
                                  const next = [...scopeRows]
                                  next[idx] = { ...row, estimatedMandays: md }
                                  setScopeRows(next)
                                } else if (activeContract) {
                                  updateScopeItem(activeContract.id, row.id, {
                                    estimatedMandays: md,
                                  })
                                }
                              }}
                              className="h-7 text-xs text-center"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold">
                              {row.estimatedMandays} MD
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              (BG: {row.handoverEstimatedMandays} MD)
                            </div>
                          </div>
                        )}
                      </TableCell>

                      {(isCreateMode || isEditingScope) && (
                        <TableCell className="pr-3 align-top py-3">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (isCreateMode) {
                                if (scopeRows.length > 1) {
                                  setScopeRows(scopeRows.filter((r) => r.id !== row.id))
                                }
                              } else if (activeContract) {
                                removeScopeItem(activeContract.id, row.id)
                              }
                            }}
                          >
                            <IconTrash className="size-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="p-4 border-t bg-slate-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">
                    Tổng Limit (Công ty cấp):
                  </span>
                  <strong className="text-foreground">
                    {roleView === "PM" ? "Đã ẩn" : `${totalScopeLimitMd} MD`}
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">
                    Tổng Target (AM ép tiến độ):
                  </span>
                  <strong className="text-primary">
                    {totalScopeTargetMd} MD
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">
                    Tổng Estimate của PM:
                  </span>
                  <strong className="text-foreground">
                    {totalScopeEstimatedMd} MD (Gồm {totalHandoverEstimatedMd} MD Bàn giao)
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">
                    Tổng giá trị HĐ cả thuế:
                  </span>
                  <strong className="text-primary text-sm">
                    {formatMoney(displayedTaxBreakdown.grandTotalWithTax)}
                  </strong>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cột phải (5 phần): Cấu hình 4 chỉ số Tài chính & ĐỢT THANH TOÁN (Payment Tranches) liên kết với Mốc */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  3. Mô Hình 4 Chỉ Số Tài Chính & Cơ Chế Thưởng 50/50
                </CardTitle>
                {roleView !== "PM" && (
                  <button
                    type="button"
                    onClick={togglePriceVisible}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {hidePrice ? (
                      <>
                        <IconEye className="size-3.5" /> Hiện số tiền
                      </>
                    ) : (
                      <>
                        <IconEyeOff className="size-3.5" /> Ẩn số tiền
                      </>
                    )}
                  </button>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-slate-50/80 p-3">
                  <span className="text-[11px] text-muted-foreground block">
                    1. Limit (Hạn mức công ty cấp)
                  </span>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {roleView === "PM" ? "Đã ẩn" : `${maxMandays} MD`}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {roleView === "PM"
                      ? "Bảo mật nội bộ"
                      : formatMoney(maxMandays * effectiveRate)}
                  </span>
                </div>

                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <span className="text-[11px] text-primary font-medium block">
                    2. Target (Mục tiêu AM ép tiến độ)
                  </span>
                  <div className="text-base font-bold text-primary mt-0.5">
                    {amTargetMandays} MD
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {roleView === "PM"
                      ? "Mốc giao cho PM"
                      : `Dự phòng Buffer: +${amBufferMandays} MD`}
                  </span>
                </div>

                <div className="rounded-lg border bg-slate-50/80 p-3">
                  <span className="text-[11px] text-muted-foreground block">
                    3. Estimate (Dự toán kỹ thuật PM)
                  </span>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {totalScopeEstimatedMd} MD
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Đã gồm {totalHandoverEstimatedMd} MD bàn giao
                  </span>
                </div>

                <div className="rounded-lg border bg-slate-50/80 p-3">
                  <span className="text-[11px] text-muted-foreground block">
                    4. Real (Thực tế tiêu hao)
                  </span>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    {isCreateMode ? "0 MD" : `${detailMetrics?.effectiveRealMandays || 0} MD`}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Cộng dồn qua các kỳ Log MD
                  </span>
                </div>
              </div>

              {roleView !== "PM" && (
                <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-3.5 space-y-1.5">
                  <div className="font-semibold text-emerald-900">
                    Cơ chế phân bổ thưởng dôi dư (Khi Real &lt; Limit):
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    • <strong>50% số tiền dôi dư</strong> giữ lại vào <strong>Quỹ bù rủi ro cho các mốc sau</strong> (nếu mốc sau bị trễ/âm quỹ).
                    <br />• <strong>50% còn lại</strong> chia thưởng cho <strong>Lead/PM, Dev và Sale/AM</strong> (hoặc dồn thưởng KPI/tháng 13).
                  </p>
                  <div className="flex justify-between pt-1 border-t border-emerald-200/80 text-[11px]">
                    <span>Đơn giá 1 Manday chuẩn:</span>
                    <strong>{formatMoney(effectiveRate)} / MD</strong>
                  </div>
                </div>
              )}

              {roleView !== "PM" && !isCreateMode && activeContract && (
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Điều chỉnh Mốc ép Target tổng giao PM:
                    </span>
                    <span className="font-semibold text-primary">
                      {amTargetMandays} MD / Limit {maxMandays} MD
                    </span>
                  </div>
                  <Slider
                    min={Math.max(10, Math.round(maxMandays * 0.5))}
                    max={maxMandays}
                    step={1}
                    value={[activeContract.amTargetMandays]}
                    onValueChange={(v) =>
                      updateTargetMandays(activeContract.id, v[0] ?? amTargetMandays)
                    }
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 4. ĐỢT THANH TOÁN (PAYMENT TRANCHES) - Chia theo % dòng tiền & có liên kết độc lập với Mốc bàn giao */}
          <Card className="shadow-none border bg-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    4. Các Đợt Thanh Toán Dòng Tiền (Payment Tranches • Liên kết Mốc)
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Chia theo % dòng tiền hợp đồng (VD: 30% - 30% - 20% - 20%), độc lập nhưng liên kết với Mốc bàn giao kỹ thuật
                  </p>
                </div>

                {roleView !== "PM" && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isCreateMode && (
                      <Button
                        type="button"
                        size="sm"
                        variant={isEditingSchedule ? "default" : "outline"}
                        className="h-7 text-xs gap-1"
                        onClick={() => setIsEditingSchedule((prev) => !prev)}
                      >
                        <IconEdit className="size-3.5" />
                        {isEditingSchedule ? "Xong" : "Sửa"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={handleAddInstallmentRow}
                    >
                      <IconPlus className="size-3.5" />
                      Thêm đợt
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between rounded-md bg-slate-50 border px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Tổng tỉ lệ dòng tiền các đợt:
                </span>
                <Badge
                  variant="outline"
                  className={
                    totalInstallmentPercent === 100
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                      : "bg-amber-50 text-amber-700 border-amber-300 font-semibold"
                  }
                >
                  {totalInstallmentPercent}% / 100%
                </Badge>
              </div>

              {isCreateMode ? (
                <div className="space-y-3">
                  {installments.map((inst, idx) => (
                    <div
                      key={inst.id}
                      className="rounded-md border p-3 space-y-2.5 text-xs bg-background"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={inst.name}
                          onChange={(e) => {
                            const next = [...installments]
                            next[idx] = { ...inst, name: e.target.value }
                            setInstallments(next)
                          }}
                          className="h-8 text-xs font-medium flex-1"
                        />
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="relative w-20">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={inst.percentage}
                              onChange={(e) => {
                                const next = [...installments]
                                next[idx] = {
                                  ...inst,
                                  percentage: Number(e.target.value) || 0,
                                }
                                setInstallments(next)
                              }}
                              className="h-8 text-xs pr-6 text-right font-semibold"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                              %
                            </span>
                          </div>
                          {installments.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setInstallments(
                                  installments.filter((r) => r.id !== inst.id)
                                )
                              }
                            >
                              <IconTrash className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className="text-[11px] text-muted-foreground block mb-1">
                            Liên kết với Mốc bàn giao kỹ thuật:
                          </span>
                          <Select
                            value={inst.linkedMilestoneId}
                            onValueChange={(val) => {
                              const ms = scopeRows.find((s) => s.id === val)
                              const next = [...installments]
                              next[idx] = {
                                ...inst,
                                linkedMilestoneId: val,
                                triggerMilestoneName: ms
                                  ? `Hoàn thành ${ms.code}: ${ms.title}`
                                  : inst.triggerMilestoneName,
                              }
                              setInstallments(next)
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Chọn Mốc liên kết..." />
                            </SelectTrigger>
                            <SelectContent>
                              {scopeRows.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.code} — {s.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground block mb-1">
                            Hạn thanh toán ({formatMoney(Math.round((baseContractValue * inst.percentage) / 100))}):
                          </span>
                          <Input
                            type="date"
                            value={inst.dueDate}
                            onChange={(e) => {
                              const next = [...installments]
                              next[idx] = { ...inst, dueDate: e.target.value }
                              setInstallments(next)
                            }}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(activeContract?.installments || []).map((inst) => {
                    const linkedMs = inst.linkedMilestoneId
                      ? activeContract?.scopeItems.find(
                          (s) => s.id === inst.linkedMilestoneId
                        )
                      : undefined
                    const isLinkedMsDone = Boolean(
                      linkedMs &&
                        (linkedMs.isAccepted || linkedMs.status === "COMPLETED")
                    )

                    return (
                      <div
                        key={inst.id}
                        className="rounded-md border bg-slate-50/60 px-3.5 py-2.5 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-foreground flex flex-wrap items-center gap-1.5">
                              <span>{inst.name}</span>
                              {inst.percentage > 0 && (
                                <Badge variant="outline" className="text-[10px] bg-white">
                                  {inst.percentage}%
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
                              <IconLink className="size-3 text-primary" />
                              <span>
                                Liên kết:{" "}
                                <strong className="text-foreground">
                                  {linkedMs
                                    ? `${linkedMs.code} (${linkedMs.ownerPic || "PM"})`
                                    : inst.triggerMilestoneName}
                                </strong>
                              </span>
                              {isLinkedMsDone && inst.paymentStatus !== "PAID" && (
                                <Badge className="bg-emerald-600 text-white border-0 text-[10px]">
                                  Mốc đã Finish → Đủ điều kiện thu tiền!
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {roleView !== "PM" && (
                              <div className="font-bold text-foreground">
                                {formatMoney(inst.amount)}
                              </div>
                            )}
                            <div className="mt-0.5">
                              {inst.paymentStatus === "PAID" ? (
                                <span className="text-[11px] font-medium text-emerald-700">
                                  ✓ Đã thu ({inst.paidDate})
                                </span>
                              ) : inst.paymentStatus === "OVERDUE" ? (
                                <span className="text-[11px] font-medium text-red-600">
                                  Quá hạn ({inst.dueDate})
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  Hạn: {inst.dueDate}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isEditingSchedule && roleView !== "PM" && activeContract && (
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                            <Select
                              value={inst.linkedMilestoneId || ""}
                              onValueChange={(val) => {
                                const ms = activeContract.scopeItems.find(
                                  (s) => s.id === val
                                )
                                updateInstallment(activeContract.id, inst.id, {
                                  linkedMilestoneId: val,
                                  triggerMilestoneName: ms
                                    ? `Hoàn thành ${ms.code}`
                                    : inst.triggerMilestoneName,
                                })
                              }}
                            >
                              <SelectTrigger className="h-7 text-[11px] bg-white">
                                <SelectValue placeholder="Chọn Mốc bàn giao liên kết" />
                              </SelectTrigger>
                              <SelectContent>
                                {activeContract.scopeItems.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.code} — {s.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="date"
                              value={inst.dueDate}
                              onChange={(e) =>
                                updateInstallment(activeContract.id, inst.id, {
                                  dueDate: e.target.value,
                                })
                              }
                              className="h-7 text-[11px] bg-white"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Thêm Khách Hàng */}
      <Dialog open={newCustomerModalOpen} onOpenChange={setNewCustomerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm Khách Hàng Mới</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Tên doanh nghiệp</Label>
              <Input
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="VD: Công ty Cổ phần Đầu tư..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mã số thuế</Label>
              <Input
                value={newCustTax}
                onChange={(e) => setNewCustTax(e.target.value)}
                placeholder="031..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Đầu mối Kỹ thuật</Label>
              <Input
                value={newCustTechName}
                onChange={(e) => setNewCustTechName(e.target.value)}
                placeholder="Họ tên & SĐT"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email Kế toán nhận Hóa đơn VAT</Label>
              <Input
                value={newCustAccEmail}
                onChange={(e) => setNewCustAccEmail(e.target.value)}
                placeholder="accounting@company.vn"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCustomerModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleQuickCreateCustomer}>Lưu Khách Hàng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
