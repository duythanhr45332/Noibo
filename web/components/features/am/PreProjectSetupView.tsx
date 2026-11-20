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
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import {
  useGetApiV1CustomersId,
  useGetApiV1CustomersOptions,
  usePostApiV1Customers,
} from "@/lib/api/generated/customers/customers"
import { useGetApiV1UsersOptions } from "@/lib/api/generated/users/users"
import { usePostApiV1Contracts } from "@/lib/api/generated/contracts/contracts"
import { usePostApiV1FilesUpload } from "@/lib/api/generated/files/files"
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
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider"
import { useWorkspaceRole } from "@/lib/hooks/use-workspace-data"
import {
  calculateContractMetrics,
  calculateTaxBreakdownFromItems,
  ContractProject,
  evaluateKickoffChecklist,
  getEffectiveMandayRate,
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
  linkedMilestoneIds: string[]
  triggerMilestoneName: string
}

interface CreditParams {
  fixedCostAllocation: number
  salesCommissionAmount: number
  riskReservePercent: number
  standardMandayRate: number
  bufferCompressionPercent: number
  contractVatRatePercent?: number
}

function computeContractTaxWithRate(
  rows: Array<Pick<DraftScopeRow, "amountBeforeVat" | "vatCategory">>,
  contractVatRatePercent?: number
) {
  if (contractVatRatePercent !== undefined) {
    const rate = Math.min(100, Math.max(0, Number(contractVatRatePercent) || 0))
    const totalBeforeVat = rows.reduce(
      (sum, r) => sum + Math.max(0, Number(r.amountBeforeVat || 0)),
      0
    )
    const totalVatTax = rate > 0 ? Math.round((totalBeforeVat * rate) / 100) : 0
    return {
      nonVatTotal: rate === 0 ? totalBeforeVat : 0,
      vat8Base: rate === 8 ? totalBeforeVat : 0,
      vat8Tax: rate === 8 ? totalVatTax : 0,
      vat10Base: rate === 10 ? totalBeforeVat : 0,
      vat10Tax: rate === 10 ? totalVatTax : 0,
      vatBaseTotal: rate > 0 ? totalBeforeVat : 0,
      totalVatTax,
      grandTotalWithTax: totalBeforeVat + totalVatTax,
    }
  }
  return calculateTaxBreakdownFromItems(rows)
}

function computeAllowedContractMaxMandays(
  rows: Array<Pick<DraftScopeRow, "amountBeforeVat" | "vatCategory">>,
  params: Pick<
    CreditParams,
    | "fixedCostAllocation"
    | "salesCommissionAmount"
    | "riskReservePercent"
    | "standardMandayRate"
    | "contractVatRatePercent"
  >
) {
  const tax = computeContractTaxWithRate(rows, params.contractVatRatePercent)
  const baseContractValue = tax.grandTotalWithTax
  const riskReserveAmount = Math.round(
    (baseContractValue * params.riskReservePercent) / 100
  )
  const creditY = Math.max(
    0,
    baseContractValue -
      (params.fixedCostAllocation +
        params.salesCommissionAmount +
        riskReserveAmount)
  )
  const allowedMaxMandays =
    params.standardMandayRate > 0
      ? Math.floor(creditY / params.standardMandayRate)
      : 0
  return { baseContractValue, riskReserveAmount, creditY, allowedMaxMandays }
}

function computeCompressedTarget(limitMd: number, compressionPct: number): number {
  const limit = Math.max(0, Math.round(Number(limitMd) || 0))
  if (limit === 0) return 0
  const pct = Math.min(100, Math.max(10, Number(compressionPct) || 80))
  return Math.min(limit, Math.max(1, Math.round((limit * pct) / 100)))
}

/**
 * Tự động phân bổ tổng trần Limit (= floor(Credit Y / Đơn giá)) theo tỷ trọng Phân bổ tiền,
 * bảo đảm tổng Limit các Mốc đúng bằng allowedMaxMandays (không thất thoát làm tròn)
 * và tự tính Target = Limit * tỷ lệ nén AM.
 */
function distributeScopeLimitsAndTargets(
  rows: DraftScopeRow[],
  params: CreditParams
): DraftScopeRow[] {
  if (rows.length === 0) return rows
  const { allowedMaxMandays } = computeAllowedContractMaxMandays(rows, params)
  const weights = rows.map((r) => Math.max(0, Number(r.amountBeforeVat || 0)))
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  const exactShares = rows.map((_, i) =>
    totalWeight > 0
      ? (weights[i] / totalWeight) * allowedMaxMandays
      : allowedMaxMandays / rows.length
  )
  const allocated = exactShares.map((s) => Math.floor(s))
  let remainder =
    allowedMaxMandays - allocated.reduce((sum, val) => sum + val, 0)

  const orderByRemainder = exactShares
    .map((s, idx) => ({ idx, frac: s - allocated[idx] }))
    .sort((a, b) => b.frac - a.frac)

  for (let i = 0; i < orderByRemainder.length && remainder > 0; i++) {
    allocated[orderByRemainder[i].idx] += 1
    remainder -= 1
  }

  return rows.map((r, idx) => {
    const limitMandays = Math.max(0, allocated[idx])
    return {
      ...r,
      limitMandays,
      targetMandays: computeCompressedTarget(
        limitMandays,
        params.bufferCompressionPercent
      ),
    }
  })
}

const INITIAL_DRAFT_FINANCIAL_PARAMS: CreditParams = {
  fixedCostAllocation: 65_000_000,
  salesCommissionAmount: 45_000_000,
  riskReservePercent: 25,
  standardMandayRate: 2_500_000,
  bufferCompressionPercent: 80,
}

const INITIAL_DRAFT_SCOPE_ROWS: DraftScopeRow[] = [
  {
    id: "s-1",
    code: "MỐC-01",
    title: "Mốc 1 (Foundation): Huấn luyện dữ liệu pháp lý & Vector DB Core",
    ownerPic: "Anh Du (Lead Foundation)",
    dueDate: "2026-11-25",
    amountBeforeVat: 220_000_000,
    vatCategory: "NON_VAT",
    limitMandays: 48,
    targetMandays: 38,
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
    limitMandays: 39,
    targetMandays: 31,
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
    vatCategory: "NON_VAT",
    limitMandays: 21,
    targetMandays: 18,
    estimatedMandays: 13,
    handoverEstimatedMandays: 4,
  },
]

interface PreProjectSetupViewProps {
  mode?: "create" | "detail"
}

export function PreProjectSetupView({ mode = "detail" }: PreProjectSetupViewProps) {
  const queryClient = useQueryClient()
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const canQueryRealApi = isAuthenticated && !isAuthLoading
  const { isPmRole } = useWorkspaceRole()
  const roleView = isPmRole ? "PM" : "AM"

  const apiCustomerOptionsQuery = useGetApiV1CustomersOptions({
    query: { enabled: canQueryRealApi },
  })
  const apiPmOptionsQuery = useGetApiV1UsersOptions(
    { role: "PM" },
    { query: { enabled: canQueryRealApi } }
  )
  const createCustomerMutation = usePostApiV1Customers()
  const createContractMutation = usePostApiV1Contracts()
  const uploadFileMutation = usePostApiV1FilesUpload()

  const {
    hidePrice,
    togglePriceVisible,
    formatMoney,
    openContractDetail,
    setActiveScreen,
    setActiveDetailTab,
  } = useWorkspaceUi()

  const isCreateMode = mode === "create"
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const [isEditingScope, setIsEditingScope] = React.useState(false)
  const [isEditingSchedule, setIsEditingSchedule] = React.useState(false)
  const [hideMoneyAllocationCol, setHideMoneyAllocationCol] =
    React.useState(false)
  const showMoneyAllocationCol = !isPmRole && !hideMoneyAllocationCol

  const [newCustomerModalOpen, setNewCustomerModalOpen] = React.useState(false)
  const [newCustName, setNewCustName] = React.useState("")
  const [newCustTax, setNewCustTax] = React.useState("")
  const [newCustTechName, setNewCustTechName] = React.useState("")
  const [newCustAccEmail, setNewCustAccEmail] = React.useState("")

  // State cho chế độ Create New Contract
  const [customerId, setCustomerId] = React.useState<string>("")
  const [contractCode, setContractCode] = React.useState(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, "0")
    const d = String(now.getDate()).padStart(2, "0")
    const suffix = String(now.getTime()).slice(-3)
    return `HĐ-${y}-${m}${d}-${suffix}`
  })
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
  const [fixedCostAllocation, setFixedCostAllocation] = React.useState<number>(
    INITIAL_DRAFT_FINANCIAL_PARAMS.fixedCostAllocation
  )
  const [salesCommissionAmount, setSalesCommissionAmount] =
    React.useState<number>(INITIAL_DRAFT_FINANCIAL_PARAMS.salesCommissionAmount)
  const [riskReservePercent, setRiskReservePercent] = React.useState<number>(
    INITIAL_DRAFT_FINANCIAL_PARAMS.riskReservePercent
  )
  const [standardMandayRate, setStandardMandayRate] = React.useState<number>(
    INITIAL_DRAFT_FINANCIAL_PARAMS.standardMandayRate
  )
  const [bufferCompressionPercent, setBufferCompressionPercent] =
    React.useState<number>(
      INITIAL_DRAFT_FINANCIAL_PARAMS.bufferCompressionPercent
    )
  const [contractVatRatePercent, setContractVatRatePercent] =
    React.useState<number>(0)
  const [invoiceMethod] = React.useState<InvoiceMethod>("BY_INSTALLMENT")

  // Danh mục MỐC BÀN GIAO KỸ THUẬT (Scope Milestones - Limit & Target tự tính từ Phân bổ tiền & Credit Y)
  const [scopeRows, setScopeRows] = React.useState<DraftScopeRow[]>(() =>
    distributeScopeLimitsAndTargets(
      INITIAL_DRAFT_SCOPE_ROWS,
      INITIAL_DRAFT_FINANCIAL_PARAMS
    )
  )

  // Lộ trình ĐỢT THANH TOÁN (Payment Tranches - hỗ trợ liên kết 1-1 hoặc N-1 nhiều Mốc)
  const [installments, setInstallments] = React.useState<DraftInstallmentRow[]>([
    {
      id: "d-1",
      name: "Đợt 1: Tạm ứng ngay sau khi ký HĐ (30%)",
      percentage: 30,
      dueDate: "2026-11-05",
      linkedMilestoneId: "",
      linkedMilestoneIds: [],
      triggerMilestoneName: "Ký Hợp đồng & Hoàn tất Checklist Kick-off",
    },
    {
      id: "d-2",
      name: "Đợt 2: Thanh toán khi hoàn thành Mốc 1 - Foundation (30%)",
      percentage: 30,
      dueDate: "2026-11-28",
      linkedMilestoneId: "s-1",
      linkedMilestoneIds: ["s-1"],
      triggerMilestoneName: "Hoàn thành Mốc 1: Foundation",
    },
    {
      id: "d-3",
      name: "Đợt 3: Thanh toán khi hoàn thành Mốc 2 - Core (20%)",
      percentage: 20,
      dueDate: "2026-12-28",
      linkedMilestoneId: "s-2",
      linkedMilestoneIds: ["s-2"],
      triggerMilestoneName: "Hoàn thành Mốc 2: Core Chatbot",
    },
    {
      id: "d-4",
      name: "Đợt 4: Tất toán khi hoàn thành Mốc 3 - Đào tạo & Nghiệm thu (20%)",
      percentage: 20,
      dueDate: "2027-01-30",
      linkedMilestoneId: "s-3",
      linkedMilestoneIds: ["s-3"],
      triggerMilestoneName: "Hoàn thành Mốc 3: Đào tạo & Bàn giao",
    },
  ])

  const activeContract = null as ContractProject | null
  const detailMetrics = null as ReturnType<typeof calculateContractMetrics> | null
  const kickoffEval = null as ReturnType<typeof evaluateKickoffChecklist> | null

  // Tự động đồng bộ Checklist Pre-Project theo dữ liệu thực tế nhập trên Form
  React.useEffect(() => {
    if (!isCreateMode) return
    const hasDrive = Boolean(googleDriveUrlDraft.trim())
    const hasScope = scopeRows.length > 0
    const hasTimeline = Boolean(startDate && expectedEndDate)
    const totalBg = scopeRows.reduce(
      (acc, r) => acc + Number(r.handoverEstimatedMandays ?? 0),
      0
    )
    setDraftChecklist((prev) => ({
      ...prev,
      driveRootCreated: hasDrive,
      driveTeamDocCreated: hasDrive,
      driveSharedDocCreated: hasDrive,
      drivePermissionsGranted: hasDrive,
      pmConfirmedScope: hasScope,
      kickoffTimelineConfirmed: hasTimeline,
      kickoffDate: startDate || prev.kickoffDate,
      handoverEstimateConfirmed: totalBg > 0,
      handoverEstimateMandays: totalBg,
    }))
  }, [isCreateMode, googleDriveUrlDraft, scopeRows, startDate, expectedEndDate])

  const apiCustomerOptions = apiCustomerOptionsQuery.data?.data || []
  const apiPmOptions = apiPmOptionsQuery.data?.data || []

  React.useEffect(() => {
    if (!canQueryRealApi) return
    if (apiCustomerOptions.length > 0) {
      const existsInApi = apiCustomerOptions.some((c) => c.customer_id === customerId)
      if (!existsInApi && apiCustomerOptions[0]?.customer_id) {
        setCustomerId(apiCustomerOptions[0].customer_id)
      }
    } else {
      setCustomerId("")
    }
  }, [canQueryRealApi, apiCustomerOptions, customerId])

  const selectedCustomerDetailQuery = useGetApiV1CustomersId(customerId || "", {
    query: { enabled: canQueryRealApi && Boolean(customerId) },
  })

  const selectedCustomerObj = React.useMemo(() => {
    const matched = apiCustomerOptions.find((c) => c.customer_id === customerId)
    const detail = selectedCustomerDetailQuery.data?.data
    return {
      id: detail?.customer_id || matched?.customer_id || "",
      companyName: detail?.name || matched?.name || "Chưa chọn khách hàng",
      taxCode: detail?.tax_code || matched?.tax_code || "—",
      techContact: {
        name: detail?.tech_contact?.name || "Chưa cập nhật",
        phone: detail?.tech_contact?.phone || "—",
      },
      accountingContact: {
        name: detail?.accounting_contact?.name || "Chưa cập nhật",
        email: detail?.accounting_contact?.email || "—",
      },
    }
  }, [apiCustomerOptions, customerId, selectedCustomerDetailQuery.data])

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
    () => computeContractTaxWithRate(scopeRows, contractVatRatePercent),
    [scopeRows, contractVatRatePercent]
  )

  const baseContractValue = isCreateMode
    ? createTaxBreakdown.grandTotalWithTax
    : activeContract?.baseContractValue || 0

  const effectiveRate = isCreateMode
    ? standardMandayRate
    : activeContract
      ? getEffectiveMandayRate(activeContract)
      : 0

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
    () =>
      isCreateMode
        ? createTaxBreakdown
        : computeContractTaxWithRate(displayedScopeRows, activeContract?.vatRatePercent),
    [isCreateMode, createTaxBreakdown, displayedScopeRows, activeContract?.vatRatePercent]
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

  const allowedCreateMaxMandays =
    effectiveRate > 0 ? Math.floor(creditY / effectiveRate) : 0
  const allowedTotalMaxMandays = isCreateMode
    ? allowedCreateMaxMandays
    : (effectiveRate > 0
        ? Math.floor(
            Math.max(
              0,
              (detailMetrics?.baseInternalCreditVnd || 0) / effectiveRate
            )
          )
        : 0) + (activeContract?.upsellAddedMandays || 0)

  const maxMandays = isCreateMode
    ? totalScopeLimitMd
    : detailMetrics?.totalMaxMandays || 0

  const amTargetMandays = isCreateMode
    ? totalScopeTargetMd
    : detailMetrics?.effectiveTargetMandays || activeContract?.amTargetMandays || 0

  const amBufferMandays = Math.max(0, maxMandays - amTargetMandays)

  const applyFinancialRecalc = (
    nextRows: DraftScopeRow[],
    overrides?: Partial<CreditParams>
  ) => {
    const params: CreditParams = {
      fixedCostAllocation,
      salesCommissionAmount,
      riskReservePercent,
      standardMandayRate,
      bufferCompressionPercent,
      contractVatRatePercent,
      ...overrides,
    }
    setScopeRows(distributeScopeLimitsAndTargets(nextRows, params))
  }

  const syncRateFromCreditAndRows = (
    nextRows: DraftScopeRow[],
    overrides?: Partial<CreditParams>
  ) => {
    const params: CreditParams = {
      fixedCostAllocation,
      salesCommissionAmount,
      riskReservePercent,
      standardMandayRate,
      bufferCompressionPercent,
      contractVatRatePercent,
      ...overrides,
    }
    const { creditY: nextCreditY } = computeAllowedContractMaxMandays(nextRows, params)
    const nextTotalLimit = nextRows.reduce(
      (sum, r) => sum + Math.max(0, Number(r.limitMandays || 0)),
      0
    )
    if (nextTotalLimit > 0 && nextCreditY > 0) {
      setStandardMandayRate(Math.floor(nextCreditY / nextTotalLimit))
    } else {
      setStandardMandayRate(0)
    }
  }

  const handleRecalcMandayRateByLimit = () => {
    if (totalScopeLimitMd <= 0) {
      toast.error("Tổng Limit các Mốc phải lớn hơn 0 MD để tính Đơn giá 1 MD")
      return
    }
    if (creditY <= 0) {
      toast.error("Credit Y đang ≤ 0 VNĐ — vui lòng kiểm tra lại giá trị HĐ và các khoản khấu trừ")
      return
    }
    const nextRate = Math.floor(creditY / totalScopeLimitMd)
    if (nextRate < 100_000) {
      toast.error(
        `Đơn giá quy đổi (${nextRate.toLocaleString("vi-VN")} đ/MD) nhỏ hơn mức tối thiểu 100.000 đ/MD. Vui lòng giảm Tổng Limit hoặc tăng Credit Y.`
      )
      return
    }
    setStandardMandayRate(nextRate)
    toast.success(
      `Đã tính lại Đơn giá 1 MD = ${formatMoney(nextRate)}/MD (${formatMoney(creditY)} ÷ ${totalScopeLimitMd} MD)`
    )
  }

  const handleCompressionPercentChange = (nextPct: number) => {
    const clampedPct = Math.min(100, Math.max(50, Number(nextPct) || 80))
    setBufferCompressionPercent(clampedPct)
    if (isCreateMode) {
      setScopeRows((prev) =>
        prev.map((row) => ({
          ...row,
          targetMandays: computeCompressedTarget(row.limitMandays, clampedPct),
        }))
      )
    }
  }

  const totalInstallmentPercent = isCreateMode
    ? installments.reduce((sum, i) => sum + Number(i.percentage || 0), 0)
    : (activeContract?.installments || []).reduce(
        (sum, i) => sum + Number(i.percentage || 0),
        0
      )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const sizeMb = `${Math.max(0.1, file.size / (1024 * 1024)).toFixed(1)} MB`

    let uploadedUrl: string | undefined
    if (canQueryRealApi) {
      try {
        const res = await uploadFileMutation.mutateAsync({
          data: {
            file,
            contract_id: !isCreateMode && activeContract ? activeContract.id : undefined,
            category: uploadCategory,
          },
        })
        uploadedUrl = res?.data?.url
      } catch {
        toast.error(`Không thể tải tệp "${file.name}" lên máy chủ`)
        e.target.value = ""
        return
      }
    }

    setDraftDocs((prev) => [
      ...prev,
      {
        id: `doc-${Date.now()}`,
        fileName: file.name,
        fileSize: sizeMb,
        category: uploadCategory,
        uploadedAt: new Date().toISOString().slice(0, 10),
        uploadedBy: user?.full_name || "AM",
      },
    ])
    toast.success(
      uploadedUrl
        ? `Đã tải tài liệu "${file.name}" lên máy chủ!`
        : `Đã đính kèm tài liệu "${file.name}"!`
    )
    e.target.value = ""
  }

  const handleRemoveDoc = (docId: string) => {
    setDraftDocs((prev) => prev.filter((d) => d.id !== docId))
  }

  const handleAddScopeRow = () => {
    const nextIdx = scopeRows.length + 1
    const nextRows: DraftScopeRow[] = [
      ...scopeRows,
      {
        id: `s-${Date.now()}`,
        code: `MỐC-0${nextIdx}`,
        title: `Mốc ${nextIdx}: Hạng mục bàn giao kỹ thuật #${nextIdx}`,
        ownerPic: pmOwner || "PM Dự án",
        dueDate: expectedEndDate,
        amountBeforeVat: 50_000_000,
        vatCategory: "NON_VAT",
        limitMandays: 0,
        targetMandays: 0,
        estimatedMandays: 12,
        handoverEstimatedMandays: 2,
      },
    ]
    applyFinancialRecalc(nextRows)
  }

  const handleAddInstallmentRow = () => {
    const currentSum = totalInstallmentPercent
    const suggestedRemaining = Math.max(0, 100 - currentSum)
    const nextIndex = installments.length + 1
    const firstId = scopeRows[0]?.id || ""
    setInstallments([
      ...installments,
      {
        id: `d-${Date.now()}`,
        name: `Đợt ${nextIndex}: Thanh toán theo tiến độ dòng tiền`,
        percentage: suggestedRemaining || 20,
        dueDate: expectedEndDate,
        linkedMilestoneId: firstId,
        linkedMilestoneIds: firstId ? [firstId] : [],
        triggerMilestoneName: `Hoàn thành Mốc liên kết đợt ${nextIndex}`,
      },
    ])
  }

  const handleQuickCreateCustomer = async () => {
    if (!newCustName.trim() || !newCustTax.trim()) {
      toast.error("Vui lòng nhập Tên công ty và Mã số thuế")
      return
    }
    if (!canQueryRealApi) {
      toast.error("Vui lòng đăng nhập để tạo khách hàng")
      return
    }
    try {
      const res = await createCustomerMutation.mutateAsync({
        data: {
          name: newCustName.trim(),
          tax_code: newCustTax.trim(),
          industry: "Doanh nghiệp",
          address: "TP. Hồ Chí Minh",
          tech_contact: {
            name: newCustTechName || "Đại diện Kỹ thuật",
            title: "IT Manager",
            phone: "0909 000 111",
            email: "tech@partner.vn",
          },
          accounting_contact: {
            name: "Phòng Kế toán",
            title: "Kế toán thanh toán",
            phone: "0909 000 222",
            email: newCustAccEmail || "accounting@partner.vn",
          },
        },
      })
      if (res?.data?.customer_id) {
        setCustomerId(res.data.customer_id)
      }
      queryClient.invalidateQueries({ queryKey: ["/api/v1/customers/options"] })
      queryClient.invalidateQueries({ queryKey: ["/api/v1/customers"] })
      toast.success(`Đã tạo khách hàng "${newCustName.trim()}" vào CSDL`)
      setNewCustomerModalOpen(false)
      setNewCustName("")
      setNewCustTax("")
    } catch {
      toast.error("Không thể tạo khách hàng (trùng MST hoặc dữ liệu không hợp lệ)")
    }
  }

  const handleCreateContractSubmit = async () => {
    if (!contractCode.trim() || !contractName.trim()) {
      toast.error("Vui lòng nhập Mã hợp đồng và Tên hợp đồng/dự án")
      return
    }
    if (standardMandayRate <= 0) {
      toast.error("Đơn giá 1 Manday chuẩn phải lớn hơn 0 VNĐ")
      return
    }
    if (totalScopeLimitMd > allowedCreateMaxMandays) {
      toast.error(
        `Tổng Limit các Mốc (${totalScopeLimitMd} MD) vượt quá trần Credit Y / Đơn giá (${allowedCreateMaxMandays} MD)! Vui lòng giảm Limit hoặc tăng giá trị HĐ.`
      )
      return
    }
    const invalidTargetRow = scopeRows.find(
      (r) => Number(r.targetMandays) > Number(r.limitMandays)
    )
    if (invalidTargetRow) {
      toast.error(
        `Mức giao PM (Target) của ${invalidTargetRow.code} (${invalidTargetRow.targetMandays} MD) không được vượt Limit (${invalidTargetRow.limitMandays} MD)!`
      )
      return
    }
    if (!installments[0] || Number(installments[0].percentage || 0) <= 0) {
      toast.error(
        "Bắt buộc phải có Đợt 1 Tạm ứng (> 0%) ngay sau khi ký HĐ để kiểm soát điều kiện bắt đầu dự án!"
      )
      return
    }
    if (totalInstallmentPercent !== 100) {
      toast.error(
        `Tổng tỉ lệ các đợt thanh toán đang là ${totalInstallmentPercent}%. Vui lòng điều chỉnh đủ 100%!`
      )
      return
    }

    if (!canQueryRealApi) {
      toast.error("Vui lòng đăng nhập để tạo Hợp đồng")
      return
    }
    if (!customerId) {
      toast.error("Vui lòng chọn hoặc tạo mới một Khách hàng trước khi lập Hợp đồng")
      return
    }
    try {
      const matchedPm = apiPmOptions.find(
        (p) => p.user_id === pmOwner || p.full_name === pmOwner
      )
      const createdRes = await createContractMutation.mutateAsync({
        data: {
          code: contractCode.trim(),
          name: contractName.trim(),
          customer_id: customerId,
          owner_pm_id: matchedPm?.user_id || null,
          signed_date: new Date().toISOString().slice(0, 10),
          start_date: startDate,
          end_date: expectedEndDate,
          check_cycle_days: 2,
          fixed_cost_allocation: fixedCostAllocation,
          sales_commission_amount: salesCommissionAmount,
          risk_reserve_percent: riskReservePercent,
          standard_manday_rate: standardMandayRate,
          compression_ratio: bufferCompressionPercent / 100,
          vat_rate_percent: contractVatRatePercent,
          invoice_method: invoiceMethod,
          drive_root_url: googleDriveUrlDraft,
          kickoff_checklist: {
            ...draftChecklist,
            handoverEstimateMandays:
              totalHandoverEstimatedMd || draftChecklist.handoverEstimateMandays,
          },
          scope_items: scopeRows.map((r, idx) => ({
            temp_key: r.id,
            code: r.code || `MỐC-0${idx + 1}`,
            title: r.title || `Mốc bàn giao #${idx + 1}`,
            owner_pic: r.ownerPic || pmOwner,
            amount_before_vat: Number(r.amountBeforeVat) || 0,
            vat_category: r.vatCategory,
            limit_mandays: Math.max(0, Number(r.limitMandays ?? 0)),
            target_mandays: Math.max(0, Number(r.targetMandays ?? 0)),
            estimated_mandays: Math.max(0, Number(r.estimatedMandays ?? 0)),
            handover_estimated_mandays: Math.max(
              0,
              Number(r.handoverEstimatedMandays ?? 0)
            ),
            due_date: r.dueDate || expectedEndDate,
          })),
          installments: installments.map((inst, idx) => ({
            code: `DOT-${idx + 1}`,
            label: inst.name,
            trigger_type: idx === 0 ? "ADVANCE" : "MILESTONE",
            percentage: Number(inst.percentage || 0),
            due_date: inst.dueDate || null,
            linked_milestone_keys:
              inst.linkedMilestoneIds.length > 0
                ? inst.linkedMilestoneIds
                : inst.linkedMilestoneId
                  ? [inst.linkedMilestoneId]
                  : [],
          })),
        },
      })
      queryClient.invalidateQueries({ queryKey: ["/api/v1/contracts"] })
      toast.success(`Đã khởi tạo hợp đồng "${contractCode.trim()}" lên máy chủ!`)
      const createdId = createdRes?.data?.contract_id
      if (createdId) {
        openContractDetail(createdId)
      } else {
        setActiveScreen("contracts")
      }
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }> } }
      }
      toast.error(
        axiosErr?.response?.data?.errors?.[0]?.message ||
          "Không thể khởi tạo hợp đồng trên máy chủ"
      )
    }
  }

  const effectiveChecklist: PreKickoffChecklist = draftChecklist

  const handleToggleChecklistField = (patch: Partial<PreKickoffChecklist>) => {
    setDraftChecklist((prev) => ({ ...prev, ...patch }))
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
                Trước khi bấm <strong>Start dự án</strong> hoặc <strong>Start mốc mới</strong>, AM bắt buộc kiểm tra đủ 4 nhóm điều kiện dưới đây (Đặc biệt: Cấu trúc 3 thư mục Google Drive & Dự toán thời gian bàn giao Handover).
              </p>
            </div>
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

      {/* Bố cục lưới 2x2 đều nhau 4 ô — chiều cao đồng nhất gọn gàng, không khoảng trắng thừa */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Ô 1 (Hàng 1 - Trái): Thông tin Hợp đồng, Khách hàng & Tài liệu */}
        <Card className="shadow-none border bg-card lg:h-[460px] min-w-0 flex flex-col overflow-hidden lg:order-1">
            <CardHeader className="py-3 px-4 border-b shrink-0">
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

            <CardContent className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Khách hàng doanh nghiệp</Label>
                  {isCreateMode ? (
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Chọn khách hàng..." />
                      </SelectTrigger>
                      <SelectContent>
                        {apiCustomerOptions.length > 0 ? (
                          apiCustomerOptions.map((c) => (
                            <SelectItem key={c.customer_id} value={c.customer_id || ""}>
                              {c.name} {c.tax_code ? `(MST: ${c.tax_code})` : ""}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            Chưa có khách hàng nào — hãy bấm &ldquo;+ Thêm nhanh KH&rdquo;.
                          </div>
                        )}
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

          {/* Ô 2 (Hàng 2 - Trái): MỐC BÀN GIAO KỸ THUẬT (SCOPE MILESTONES) - Tách biệt rõ với Đợt thanh toán, có Người phụ trách riêng & 4 chỉ số Tài chính */}
          <Card className="shadow-none border bg-card lg:h-[460px] min-w-0 flex flex-col overflow-hidden lg:order-3">
            <CardHeader className="py-3 px-4 border-b shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    2. Các Mốc Bàn Giao Kỹ Thuật (Scope Milestones • Có Người Phụ Trách Riêng)
                  </CardTitle>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Chia theo module kỹ thuật (Foundation, Core, Đào tạo/UAT). Mỗi mốc có Người phụ trách (PIC) riêng và bộ chỉ số <strong>Limit • Target • Estimate (gồm Bàn giao)</strong>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {roleView !== "PM" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        setHideMoneyAllocationCol((prev) => !prev)
                      }
                    >
                      {hideMoneyAllocationCol ? (
                        <>
                          <IconEye className="size-3.5" />
                          Hiện phân bổ tiền
                        </>
                      ) : (
                        <>
                          <IconEyeOff className="size-3.5" />
                          Ẩn phân bổ tiền
                        </>
                      )}
                    </Button>
                  )}
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

            <CardContent className="p-0 flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="w-[92px] min-w-[88px] pl-4 text-xs">Mã Mốc</TableHead>
                    <TableHead className="min-w-[260px] text-xs">Mốc bàn giao & Người phụ trách (PIC)</TableHead>
                    {showMoneyAllocationCol && (
                      <TableHead className="w-[160px] min-w-[155px] text-xs">
                        Phân bổ tiền
                      </TableHead>
                    )}
                    {roleView !== "PM" && (
                      <TableHead className="w-[100px] min-w-[96px] text-center text-xs">
                        Limit
                      </TableHead>
                    )}
                    <TableHead className="w-[100px] min-w-[96px] text-center text-xs text-primary">
                      Target
                    </TableHead>
                    <TableHead className="w-[138px] min-w-[132px] text-center text-xs">
                      Est & BG (MD)
                    </TableHead>
                    {(isCreateMode || isEditingScope) && <TableHead className="w-[40px]" />}
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
                                const next = [...scopeRows]
                                next[idx] = { ...row, title: e.target.value }
                                setScopeRows(next)
                              }}
                              className="h-7 text-xs"
                            />
                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                              <Select
                                value={row.ownerPic}
                                onValueChange={(v) => {
                                  const next = [...scopeRows]
                                  next[idx] = { ...row, ownerPic: v }
                                  setScopeRows(next)
                                }}
                              >
                                <SelectTrigger className="h-7 text-[11px] flex-1 min-w-[155px]">
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
                                  const next = [...scopeRows]
                                  next[idx] = { ...row, dueDate: e.target.value }
                                  setScopeRows(next)
                                }}
                                className="h-7 text-[11px] w-[132px] shrink-0"
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

                      {showMoneyAllocationCol && (
                        <TableCell className="text-xs font-medium align-top py-3">
                          {isCreateMode || isEditingScope ? (
                            hidePrice ? (
                              <button
                                type="button"
                                onClick={togglePriceVisible}
                                title="Bấm để hiện số tiền và chỉnh sửa Phân bổ tiền"
                                className="flex h-7 w-full min-w-[138px] items-center justify-between rounded-md border border-dashed border-slate-300 bg-slate-50 px-2.5 text-xs text-slate-600 hover:bg-slate-100"
                              >
                                <span className="tabular-nums">
                                  {formatMoney(row.amountBeforeVat)}
                                </span>
                                <IconEye className="size-3.5 text-slate-400 shrink-0" />
                              </button>
                            ) : (
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  step={10_000_000}
                                  value={row.amountBeforeVat}
                                  onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value) || 0)
                                    const next = [...scopeRows]
                                    next[idx] = { ...row, amountBeforeVat: val }
                                    setScopeRows(next)
                                    syncRateFromCreditAndRows(next)
                                  }}
                                  className="h-7 text-xs tabular-nums min-w-[138px]"
                                />
                                <div className="text-[10px] text-muted-foreground tabular-nums">
                                  {formatMoney(row.amountBeforeVat)}
                                </div>
                              </div>
                            )
                          ) : (
                            formatMoney(row.amountBeforeVat)
                          )}
                        </TableCell>
                      )}

                      {/* 1. Limit MD (Chỉnh tự do -> Đơn giá 1 MD tự tính động = Credit Y / Tổng Limit) */}
                      {roleView !== "PM" && (
                        <TableCell className="text-center text-xs font-bold align-top py-3">
                          {isCreateMode || isEditingScope ? (
                            <Input
                              type="number"
                              min={0}
                              value={row.limitMandays}
                              onChange={(e) => {
                                const nextMd = Math.max(0, Number(e.target.value) || 0)
                                const next = [...scopeRows]
                                next[idx] = {
                                  ...row,
                                  limitMandays: nextMd,
                                  targetMandays: Math.min(
                                    row.targetMandays,
                                    nextMd
                                  ),
                                }
                                setScopeRows(next)
                                syncRateFromCreditAndRows(next)
                              }}
                              className="h-7 text-xs text-center tabular-nums min-w-[78px]"
                            />
                          ) : (
                            `${row.limitMandays} MD`
                          )}
                        </TableCell>
                      )}

                      {/* 2. Target MD (Khóa <= Limit của Mốc) */}
                      <TableCell className="text-center text-xs font-bold text-primary align-top py-3">
                        {isCreateMode || isEditingScope ? (
                          <Input
                            type="number"
                            min={0}
                            max={row.limitMandays}
                            value={row.targetMandays}
                            onChange={(e) => {
                              const rawMd = Math.max(0, Number(e.target.value) || 0)
                              const clampedMd = Math.min(rawMd, row.limitMandays)
                              if (rawMd > row.limitMandays) {
                                toast.warning(
                                  `Mức giao PM (Target) không được vượt quá Limit (${row.limitMandays} MD) của ${row.code}!`
                                )
                              }
                              const next = [...scopeRows]
                              next[idx] = { ...row, targetMandays: clampedMd }
                              setScopeRows(next)
                            }}
                            className="h-7 text-xs text-center tabular-nums min-w-[78px]"
                          />
                        ) : (
                          `${row.targetMandays} MD`
                        )}
                      </TableCell>

                      {/* 3. Estimate MD + ô nhập BG (Bàn giao) riêng từng Mốc */}
                      <TableCell className="text-center text-xs align-top py-3">
                        {isCreateMode || isEditingScope ? (
                          <div className="space-y-1.5 min-w-[114px]">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500 w-7 text-left shrink-0">
                                Est:
                              </span>
                              <Input
                                type="number"
                                min={0}
                                value={row.estimatedMandays}
                                onChange={(e) => {
                                  const md = Math.max(0, Number(e.target.value) || 0)
                                  const next = [...scopeRows]
                                  next[idx] = { ...row, estimatedMandays: md }
                                  setScopeRows(next)
                                }}
                                className="h-7 text-xs text-center tabular-nums"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-amber-700 font-medium w-7 text-left shrink-0">
                                BG:
                              </span>
                              <Input
                                type="number"
                                min={0}
                                max={row.estimatedMandays}
                                value={row.handoverEstimatedMandays}
                                onChange={(e) => {
                                  const bgMd = Math.max(0, Number(e.target.value) || 0)
                                  const nextEst = Math.max(row.estimatedMandays, bgMd)
                                  const next = [...scopeRows]
                                  next[idx] = {
                                    ...row,
                                    handoverEstimatedMandays: bgMd,
                                    estimatedMandays: nextEst,
                                  }
                                  setScopeRows(next)
                                }}
                                className="h-7 text-xs text-center tabular-nums border-amber-200 bg-amber-50/40"
                              />
                            </div>
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
                              if (scopeRows.length > 1) {
                                applyFinancialRecalc(
                                  scopeRows.filter((r) => r.id !== row.id)
                                )
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
              </div>

              <div className="px-4 py-3 border-t bg-slate-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
                <div>
                  <span className="text-muted-foreground block">
                    Tổng Limit / Trần Credit Y:
                  </span>
                  <strong
                    className={
                      totalScopeLimitMd > allowedTotalMaxMandays
                        ? "text-red-600"
                        : "text-foreground"
                    }
                  >
                    {roleView === "PM"
                      ? "Đã ẩn"
                      : `${totalScopeLimitMd} / ${allowedTotalMaxMandays} MD`}
                  </strong>
                  {roleView !== "PM" && isCreateMode && (
                    <span className="block text-[10px] text-muted-foreground mt-0.5">
                      Còn khả dụng: {Math.max(0, allowedTotalMaxMandays - totalScopeLimitMd)} MD
                    </span>
                  )}
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

        {/* Ô 3 (Hàng 1 - Phải): Cấu hình 4 chỉ số Tài chính & Cơ chế thưởng 50/50 */}
        <Card className="shadow-none border bg-card lg:h-[460px] min-w-0 flex flex-col overflow-hidden lg:order-2">
            <CardHeader className="py-3 px-4 border-b shrink-0">
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

            <CardContent className="p-4 space-y-3 text-xs flex-1 min-h-0 overflow-y-auto">
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
                    <span>Đơn giá 1 MD dự án (= Credit Y ÷ Limit):</span>
                    <strong>{formatMoney(effectiveRate)} / MD</strong>
                  </div>
                </div>
              )}

              {roleView !== "PM" && isCreateMode && (
                <div className="rounded-lg border bg-slate-50 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900">
                        Quy đổi Credit Y &amp; Tỷ lệ nén Target
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Credit Y: <strong>{formatMoney(creditY)}</strong> • Trần tối đa:{" "}
                        <strong>{allowedCreateMaxMandays} MD</strong>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleRecalcMandayRateByLimit}
                        title="Tính lại Đơn giá 1 MD = Credit Y ÷ Tổng Limit hiện tại (giữ nguyên Limit từng Mốc)"
                        className="h-7 text-[11px] bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                      >
                        Chia lại Đơn giá theo Limit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => applyFinancialRecalc(scopeRows)}
                        title="Giữ Đơn giá 1 MD hiện tại và tự chia lại Limit từng Mốc theo tỷ trọng Phân bổ tiền"
                        className="h-7 text-[11px] bg-white"
                      >
                        Chia lại Limit theo tiền
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-[11px]">
                        Đơn giá 1 MD (VNĐ • Động theo Credit Y / Limit)
                      </Label>
                      {hidePrice ? (
                        <button
                          type="button"
                          onClick={togglePriceVisible}
                          className="flex h-7 w-full items-center justify-between rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <span>{formatMoney(standardMandayRate)}</span>
                          <IconEye className="size-3.5 text-slate-400" />
                        </button>
                      ) : (
                        <Input
                          type="number"
                          step={100_000}
                          value={standardMandayRate}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0)
                            setStandardMandayRate(val)
                            applyFinancialRecalc(scopeRows, { standardMandayRate: val })
                          }}
                          className="h-7 text-xs tabular-nums bg-white"
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Quỹ rủi ro (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={riskReservePercent}
                        onChange={(e) => {
                          const val = Math.min(
                            60,
                            Math.max(0, Number(e.target.value) || 0)
                          )
                          setRiskReservePercent(val)
                          syncRateFromCreditAndRows(scopeRows, { riskReservePercent: val })
                        }}
                        className="h-7 text-xs tabular-nums bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Chi phí cố định (VNĐ)</Label>
                      {hidePrice ? (
                        <button
                          type="button"
                          onClick={togglePriceVisible}
                          className="flex h-7 w-full items-center justify-between rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <span>{formatMoney(fixedCostAllocation)}</span>
                          <IconEye className="size-3.5 text-slate-400" />
                        </button>
                      ) : (
                        <Input
                          type="number"
                          step={5_000_000}
                          value={fixedCostAllocation}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0)
                            setFixedCostAllocation(val)
                            syncRateFromCreditAndRows(scopeRows, { fixedCostAllocation: val })
                          }}
                          className="h-7 text-xs tabular-nums bg-white"
                        />
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Hoa hồng Sale (VNĐ)</Label>
                      {hidePrice ? (
                        <button
                          type="button"
                          onClick={togglePriceVisible}
                          className="flex h-7 w-full items-center justify-between rounded-md border border-dashed border-slate-300 bg-white px-2.5 text-xs text-slate-600 hover:bg-slate-100"
                        >
                          <span>{formatMoney(salesCommissionAmount)}</span>
                          <IconEye className="size-3.5 text-slate-400" />
                        </button>
                      ) : (
                        <Input
                          type="number"
                          step={5_000_000}
                          value={salesCommissionAmount}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0)
                            setSalesCommissionAmount(val)
                            syncRateFromCreditAndRows(scopeRows, {
                              salesCommissionAmount: val,
                            })
                          }}
                          className="h-7 text-xs tabular-nums bg-white"
                        />
                      )}
                    </div>
                  </div>

                  {/* Thuế suất VAT cấp Hợp đồng (AM tự chỉnh 0% / 5% / 8% / 10% hoặc số tùy chọn) */}
                  <div className="rounded-md border border-slate-200 bg-white p-2.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label className="text-[11px] font-semibold text-slate-800">
                        Thuế suất VAT hợp đồng (%)
                      </Label>
                      <div className="flex items-center gap-1">
                        {[0, 5, 8, 10].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setContractVatRatePercent(pct)
                              syncRateFromCreditAndRows(scopeRows, {
                                contractVatRatePercent: pct,
                              })
                            }}
                            className={cn(
                              "rounded px-2 py-0.5 text-[11px] font-semibold border transition-colors",
                              contractVatRatePercent === pct
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {pct}%
                          </button>
                        ))}
                        <div className="relative w-16 ml-1">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={contractVatRatePercent}
                            onChange={(e) => {
                              const val = Math.min(
                                100,
                                Math.max(0, Number(e.target.value) || 0)
                              )
                              setContractVatRatePercent(val)
                              syncRateFromCreditAndRows(scopeRows, {
                                contractVatRatePercent: val,
                              })
                            }}
                            className="h-6 text-[11px] pr-5 text-right tabular-nums"
                          />
                          <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center justify-between">
                      <span>Tiền thuế VAT ({contractVatRatePercent}%):</span>
                      <strong className="text-slate-800 tabular-nums">
                        {formatMoney(createTaxBreakdown.totalVatTax)}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Tỷ lệ nén Target tự động (% của Limit):
                      </span>
                      <span className="font-semibold text-primary tabular-nums">
                        {bufferCompressionPercent}% ({amTargetMandays} / {maxMandays} MD)
                      </span>
                    </div>
                    <Slider
                      min={50}
                      max={100}
                      step={5}
                      value={[bufferCompressionPercent]}
                      onValueChange={(v) =>
                        handleCompressionPercentChange(v[0] ?? 80)
                      }
                    />
                  </div>
                </div>
              )}

            </CardContent>
          </Card>

          {/* Ô 4 (Hàng 2 - Phải): ĐỢT THANH TOÁN (PAYMENT TRANCHES) - Chia theo % dòng tiền & có liên kết độc lập với Mốc bàn giao */}
          <Card className="shadow-none border bg-card lg:h-[460px] min-w-0 flex flex-col overflow-hidden lg:order-4">
            <CardHeader className="py-3 px-4 border-b shrink-0">
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

            <CardContent className="p-4 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
              <div className="flex items-center justify-between rounded-md bg-slate-50 border px-3 py-1.5 text-xs">
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
                <div className="space-y-2.5">
                  {installments.map((inst, idx) => (
                    <div
                      key={inst.id}
                      className="rounded-md border p-2.5 space-y-2 text-xs bg-background"
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

                      <div className="grid grid-cols-1 gap-2.5">
                        <div>
                          <span className="text-[11px] text-muted-foreground block mb-1.5">
                            Liên kết Mốc bàn giao (hỗ trợ chọn gộp N-1 Mốc để kích hoạt Đợt này):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {scopeRows.map((s) => {
                              const selectedIds =
                                inst.linkedMilestoneIds.length > 0
                                  ? inst.linkedMilestoneIds
                                  : inst.linkedMilestoneId
                                    ? [inst.linkedMilestoneId]
                                    : []
                              const isChecked = selectedIds.includes(s.id)
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    const nextIds = isChecked
                                      ? selectedIds.filter((id) => id !== s.id)
                                      : [...selectedIds, s.id]
                                    const linkedNames = scopeRows
                                      .filter((r) => nextIds.includes(r.id))
                                      .map((r) => r.code)
                                      .join(" + ")
                                    const next = [...installments]
                                    next[idx] = {
                                      ...inst,
                                      linkedMilestoneIds: nextIds,
                                      linkedMilestoneId: nextIds[0] || "",
                                      triggerMilestoneName: linkedNames
                                        ? `Hoàn thành ${linkedNames}`
                                        : inst.triggerMilestoneName,
                                    }
                                    setInstallments(next)
                                  }}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                                    isChecked
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {isChecked && <IconCheck className="size-3" />}
                                  <span>{s.code}</span>
                                </button>
                              )
                            })}
                          </div>
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
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
