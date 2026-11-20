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
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconTag,
  IconUpload,
} from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useAuth } from "@/components/providers/auth-provider"
import { usePostApiV1FilesUpload } from "@/lib/api/generated/files/files"
import {
  useGetApiV1Contracts,
  useGetApiV1ContractsId,
  usePatchApiV1ContractsId,
  usePostApiV1ContractsIdChangeRequests,
  usePostApiV1ContractsIdClose,
  usePostApiV1ContractsIdKickoff,
  usePostApiV1ContractsIdScopeItems,
} from "@/lib/api/generated/contracts/contracts"
import {
  usePatchApiV1ScopeItemsId,
  usePostApiV1ScopeItemsIdDisburseBonus,
  usePostApiV1ScopeItemsIdFinish,
  usePostApiV1ScopeItemsIdLogs,
  usePostApiV1ScopeItemsIdReopen,
} from "@/lib/api/generated/scope-items/scope-items"
import { usePatchApiV1InstallmentsIdPay } from "@/lib/api/generated/installments/installments"
import { usePatchApiV1ChangeRequestsId } from "@/lib/api/generated/change-requests/change-requests"
import {
  isUuidString,
  mapApiContractDetailToProject,
  mapApiContractSummaryToProject,
} from "@/lib/api/contract-mapper"
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
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider"
import { useWorkspaceRole } from "@/lib/hooks/use-workspace-data"
import {
  MandayBulletBar,
  PersonAvatar,
  ProductiveDonutRing,
} from "@/components/features/am/ProductiveHomeDashboard"
import {
  calculateContractMetrics,
  ChangeRequestItem,
  ChangeRequestType,
  ContractProject,
  evaluateKickoffChecklist,
  FREE_SUPPORT_MAX_MD_PER_MILESTONE,
  getEffectiveMandayRate,
  getMilestoneFourMetrics,
  getMilestoneFreeSupportUsedMd,
  PreKickoffChecklist,
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

interface ContractWorkspaceViewProps {
  contractIdParam?: string
}

const EMPTY_CONTRACT_SHELL: ContractProject = {
  id: "",
  contractCode: "",
  projectName: "",
  customerId: "",
  customerName: "",
  signedDate: "",
  startDate: "",
  expectedEndDate: "",
  amOwner: "",
  pmOwner: "",
  phase: "PRE_PROJECT",
  googleDriveUrl: "",
  drivePermissionsVerified: false,
  baseContractValue: 0,
  approvedUpsellValue: 0,
  fixedCostAllocation: 0,
  salesCommissionAmount: 0,
  riskReservePercent: 0,
  standardMandayRate: 2_500_000,
  initialMaxMandays: 0,
  upsellAddedMandays: 0,
  amTargetMandays: 0,
  pmEstimatedMandays: 0,
  actualConsumedMandays: 0,
  hasVatItems: false,
  hasNonVatItems: true,
  vatRatePercent: 0,
  vatPortionAmount: 0,
  nonVatPortionAmount: 0,
  invoiceMethod: "BY_INSTALLMENT",
  externalAccountantNote: "",
  manualForceRedFlag: false,
  quickActionBlocker: "",
  installments: [],
  scopeItems: [],
  changeRequests: [],
  handover: {
    sourceCodeDelivered: false,
    userGuideAndVideoDelivered: false,
    signedAcceptanceScanUploaded: false,
  },
  kpiBonusSplitPercent: 50,
}

export function ContractWorkspaceView({ contractIdParam }: ContractWorkspaceViewProps = {}) {
  const queryClient = useQueryClient()
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const canQueryRealApi = isAuthenticated && !isAuthLoading
  const {
    effectiveRole,
    isPmRole,
    canConfirmAccountantOps: canConfirmBonusPayout,
  } = useWorkspaceRole()
  const uploadScanMutation = usePostApiV1FilesUpload()
  const bbntScanInputRef = React.useRef<HTMLInputElement | null>(null)

  const { openContractDetail, setActiveScreen, formatMoney } = useWorkspaceUi()
  const roleView: "AM" | "BOD" | "PM" = isPmRole
    ? "PM"
    : effectiveRole === "BOD" || effectiveRole === "ADMIN"
      ? "BOD"
      : "AM"

  const effectiveId = contractIdParam || ""
  const isApiContract = canQueryRealApi && isUuidString(effectiveId)

  const apiContractDetailQuery = useGetApiV1ContractsId(effectiveId, {
    query: { enabled: isApiContract },
  })
  const apiContractListQuery = useGetApiV1Contracts(
    { page: 1, limit: 100 },
    { query: { enabled: canQueryRealApi } }
  )

  const kickoffMutation = usePostApiV1ContractsIdKickoff()
  const updateContractMutation = usePatchApiV1ContractsId()
  const logMandaysMutation = usePostApiV1ScopeItemsIdLogs()
  const finishMutation = usePostApiV1ScopeItemsIdFinish()
  const reopenMutation = usePostApiV1ScopeItemsIdReopen()
  const disburseBonusMutation = usePostApiV1ScopeItemsIdDisburseBonus()
  const payInstallmentMutation = usePatchApiV1InstallmentsIdPay()
  const patchScopeMutation = usePatchApiV1ScopeItemsId()
  const createScopeMutation = usePostApiV1ContractsIdScopeItems()
  const createCrMutation = usePostApiV1ContractsIdChangeRequests()
  const resolveCrMutation = usePatchApiV1ChangeRequestsId()
  const closeContractMutation = usePostApiV1ContractsIdClose()
  const [approvingCrId, setApprovingCrId] = React.useState<string | null>(null)
  const canApproveChangeRequest =
    !isPmRole && effectiveRole !== "ACCOUNTANT"

  const [handoverOverride, setHandoverOverride] = React.useState<
    Partial<ContractProject["handover"]>
  >({})

  React.useEffect(() => {
    setHandoverOverride({})
  }, [effectiveId])

  const contracts = React.useMemo(() => {
    return (apiContractListQuery.data?.data?.items || []).map(
      mapApiContractSummaryToProject
    )
  }, [apiContractListQuery.data])

  const resolvedRealContract = React.useMemo(() => {
    if (isApiContract && apiContractDetailQuery.data?.data) {
      return mapApiContractDetailToProject(apiContractDetailQuery.data.data)
    }
    return null
  }, [isApiContract, apiContractDetailQuery.data])

  const contract = React.useMemo(() => {
    const base = resolvedRealContract || EMPTY_CONTRACT_SHELL
    if (Object.keys(handoverOverride).length === 0) return base
    return {
      ...base,
      handover: {
        ...base.handover,
        ...handoverOverride,
      },
    }
  }, [resolvedRealContract, handoverOverride])

  const handleUpdateHandoverDraft = React.useCallback(
    (patch: Partial<ContractProject["handover"]>) => {
      setHandoverOverride((prev) => ({ ...prev, ...patch }))
    },
    []
  )

  const handleUpdateCustomTags = React.useCallback(
    async (nextTags: string[], successMsg: string) => {
      if (!isApiContract) return
      try {
        await updateContractMutation.mutateAsync({
          id: contract.id,
          data: { am_custom_tags: nextTags },
        })
        queryClient.invalidateQueries({ queryKey: ["/api/v1/contracts"] })
        queryClient.invalidateQueries({
          queryKey: [`/api/v1/contracts/${effectiveId}`],
        })
        toast.success(successMsg)
      } catch {
        toast.error("Không thể cập nhật nhãn hợp đồng")
      }
    },
    [isApiContract, updateContractMutation, contract.id, queryClient, effectiveId]
  )

  const invalidateCurrentContract = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/v1/contracts"] })
    queryClient.invalidateQueries({
      queryKey: [`/api/v1/contracts/${effectiveId}`],
    })
  }, [queryClient, effectiveId])
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
  const [vatModalOpen, setVatModalOpen] = React.useState(false)
  const [vatRateDraft, setVatRateDraft] = React.useState<string>("0")

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
  const [newScopeVat, setNewScopeVat] = React.useState<VatCategory>("NON_VAT")

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

  const handleSubmitPeriodicLog = async () => {
    if (!activeScope) return
    const delta = Number(logDeltaMd)
    if (isNaN(delta) || delta <= 0) {
      toast.error("Vui lòng nhập số Manday tiêu hao > 0")
      return
    }
    const noteText =
      logNote.trim() ||
      `Check-in định kỳ ${activeScope.code || "Mốc"}: +${delta} MD`

    if (!isApiContract) return
    try {
      await logMandaysMutation.mutateAsync({
        id: activeScope.id,
        data: {
          delta_mandays: delta,
          check_date: logDate,
          note: noteText,
        },
      })
      invalidateCurrentContract()
      toast.success(`Đã ghi nhận +${delta} ngày công cho ${activeScope.code}!`)
      setLogNote("")
      setLogModeOpen(false)
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }> } }
      }
      toast.error(
        axiosErr?.response?.data?.errors?.[0]?.message ||
          "Không thể ghi nhận ngày công"
      )
    }
  }

  const handleSaveScopeConfig = async () => {
    if (!activeScope || !isApiContract) return
    const limitVal = Math.max(1, Number(editLimitMd) || 1)
    const targetVal = Math.max(1, Number(editTargetMd) || 1)
    const codeVal = Math.max(0, Number(editCodeEstMd) || 0)
    const handoverVal = Math.max(0, Number(editHandoverEstMd) || 0)

    try {
      await patchScopeMutation.mutateAsync({
        id: activeScope.id,
        data: {
          owner_pic: editPic.trim() || contract.pmOwner,
          due_date: editDueDate || null,
          ...(user?.role === "ADMIN" || user?.role === "BOD"
            ? { limit_mandays: limitVal }
            : {}),
          ...(user?.role !== "PM" ? { target_mandays: targetVal } : {}),
          estimated_mandays: codeVal + handoverVal,
          handover_estimated_mandays: handoverVal,
        },
      })
      invalidateCurrentContract()
      setEditScopeMode(false)
      toast.success("Đã cập nhật cấu hình 4 chỉ số của Mốc bàn giao!")
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }> } }
      }
      toast.error(
        axiosErr?.response?.data?.errors?.[0]?.message ||
          "Không thể cập nhật chỉ số Mốc"
      )
    }
  }

  const handleCreateScopeItem = async () => {
    if (!isApiContract) return
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

    try {
      await createScopeMutation.mutateAsync({
        id: contract.id,
        data: {
          code,
          title: newScopeTitle.trim(),
          owner_pic: newScopePic.trim() || contract.pmOwner,
          due_date: newScopeDueDate || null,
          amount_before_vat: priceVal,
          vat_category: newScopeVat,
          limit_mandays: limitVal,
          target_mandays: targetVal,
          estimated_mandays: codeEstVal + handoverEstVal,
          handover_estimated_mandays: handoverEstVal,
        },
      })
      invalidateCurrentContract()
      toast.success(`Đã thêm mốc ${code} vào hợp đồng!`)
      setAddScopeOpen(false)
      setNewScopeCode("")
      setNewScopeTitle("")
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }> } }
      }
      toast.error(
        axiosErr?.response?.data?.errors?.[0]?.message ||
          "Không thể thêm Mốc bàn giao"
      )
    }
  }

  const handleSubmitScopeCr = async () => {
    if (!activeScope || !isApiContract) return
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

    try {
      await createCrMutation.mutateAsync({
        id: contract.id,
        data: {
          target_scope_item_id: activeScope.id,
          cr_type: crType,
          title: crTitle.trim(),
          description: `Phát sinh tại mốc ${activeScope.code}: ${crTitle.trim()}`,
          requested_by_client_contact: contract.customerName,
          dev_mandays: devMd,
          pm_estimated_mandays: devMd,
          am_allocated_to_pm_mandays:
            crType === "UPSELL" ? Math.max(1, Number(crTargetMd) || devMd) : devMd,
          quoted_price_vnd:
            crType === "UPSELL" ? Math.max(0, Number(crQuoteVnd) || 0) : 0,
          vat_category:
            Number(contract.vatRatePercent || 0) === 0
              ? "NON_VAT"
              : Number(contract.vatRatePercent) === 8
                ? "VAT_8"
                : "VAT_10",
          timeline_impact_days: crType === "UPSELL" ? 5 : 0,
        },
      })
      invalidateCurrentContract()
      toast.success(`Đã ghi nhận ${crType === "FREE_SUPPORT" ? "Hỗ trợ 0đ" : "Phụ lục Upsell"} cho ${activeScope.code}!`)
      setCrTitle("")
      setAddCrMode(false)
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }> } }
      }
      toast.error(
        axiosErr?.response?.data?.errors?.[0]?.message ||
          "Không thể ghi nhận phát sinh"
      )
    }
  }

  const handleApproveChangeRequest = async (cr: ChangeRequestItem) => {
    if (!canApproveChangeRequest) {
      toast.error("Chỉ AM / BOD / Admin được duyệt phụ lục phát sinh")
      return
    }
    if (!isApiContract || !isUuidString(cr.id)) return
    const effectiveAllocMd = Math.max(
      0.5,
      Number(cr.amAllocatedToPmMandays || cr.pmEstimatedMandays || 1)
    )
    const effectiveQuotedPrice =
      Number(cr.quotedPriceVnd || 0) > 0
        ? Math.round(Number(cr.quotedPriceVnd))
        : Math.round(
            effectiveAllocMd * Math.max(100_000, getEffectiveMandayRate(contract))
          )

    setApprovingCrId(cr.id)
    try {
      await resolveCrMutation.mutateAsync({
        id: cr.id,
        data: {
          status: "APPROVED_UPSELL",
          am_allocated_to_pm_mandays: effectiveAllocMd,
          quoted_price_vnd: effectiveQuotedPrice,
        },
      })
      invalidateCurrentContract()
      toast.success(`Đã duyệt phụ lục ${cr.code} và cộng Trần ngày vào Mốc!`)
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }> } }
      }
      toast.error(
        axiosErr?.response?.data?.errors?.[0]?.message ||
          "Không thể duyệt phụ lục phát sinh"
      )
    } finally {
      setApprovingCrId(null)
    }
  }

  const handlePersistKickoffPatch = async (
    checklistPatch: Partial<PreKickoffChecklist>,
    extra?: {
      drive_permissions_verified?: boolean
      bod_allow_kickoff_without_advance?: boolean
    }
  ) => {
    if (!isApiContract) return
    const mergedChecklist = {
      ...kickoffEval.checklist,
      ...checklistPatch,
    }

    try {
      const res = await updateContractMutation.mutateAsync({
        id: contract.id,
        data: {
          kickoff_checklist: mergedChecklist,
          ...(extra?.drive_permissions_verified !== undefined
            ? { drive_permissions_verified: extra.drive_permissions_verified }
            : {}),
          ...(extra?.bod_allow_kickoff_without_advance !== undefined
            ? {
                bod_allow_kickoff_without_advance:
                  extra.bod_allow_kickoff_without_advance,
              }
            : {}),
        },
      })
      invalidateCurrentContract()
      const updatedPhase = (
        res as { data?: { phase?: string } } | undefined
      )?.data?.phase
      if (updatedPhase === "IN_PROJECT" && contract.phase === "PRE_PROJECT") {
        toast.success(
          "Đã đạt đủ điều kiện Pre-Project — Hệ thống tự động chuyển dự án sang Đang triển khai (IN_PROJECT)!"
        )
        setKickoffDrawerOpen(false)
      } else if (extra?.bod_allow_kickoff_without_advance) {
        toast.success("Ban Giám Đốc đã duyệt ngoại lệ khởi động dự án!")
      } else {
        toast.success("Đã cập nhật Hồ sơ khởi động dự án!")
      }
    } catch (err) {
      const axiosErr = err as {
        response?: { data?: { errors?: Array<{ message?: string }> } }
      }
      toast.error(
        axiosErr?.response?.data?.errors?.[0]?.message ||
          "Không thể cập nhật Hồ sơ khởi động"
      )
    }
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

  if (isApiContract && apiContractDetailQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-sm text-slate-500">
        Đang tải chi tiết Dự án từ máy chủ...
      </div>
    )
  }

  if (!resolvedRealContract) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 text-center space-y-3">
          <div className="text-base font-semibold text-slate-900">
            Không tìm thấy Dự án
          </div>
          <p className="text-sm text-slate-500">
            Mã dự án &ldquo;{effectiveId || "—"}&rdquo; không tồn tại trên hệ thống hoặc đã bị xóa.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveScreen("contracts")}
          >
            Quay lại Danh sách Dự án
          </Button>
        </div>
      </div>
    )
  }

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
              onValueChange={(val) => openContractDetail(val)}
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

            {contract.phase === "PRE_PROJECT" && (
              <Button
                size="sm"
                disabled={
                  !metrics.canKickoffToInProject || kickoffMutation.isPending
                }
                onClick={async () => {
                  try {
                    await kickoffMutation.mutateAsync({ id: contract.id })
                    invalidateCurrentContract()
                    toast.success(
                      "Đã Start Dự Án (Kick-off) chuyển sang giai đoạn In-Project!"
                    )
                  } catch (err) {
                    const axiosErr = err as {
                      response?: {
                        data?: { errors?: Array<{ message?: string }> }
                      }
                    }
                    toast.error(
                      axiosErr?.response?.data?.errors?.[0]?.message ||
                        "Chưa đủ điều kiện Start Dự Án"
                    )
                  }
                }}
                className="h-8 gap-1.5 text-xs"
              >
                {metrics.canKickoffToInProject ? (
                  <>
                    <IconPlayerPlay className="size-3.5" />
                    <span>Start Dự Án</span>
                  </>
                ) : (
                  <>
                    <IconLock className="size-3.5" />
                    <span>Chờ đủ Kick-off & Đợt 1</span>
                  </>
                )}
              </Button>
            )}

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

            {/* Button: Sửa % Thuế VAT của Hợp đồng (AM / Kế toán / BOD / Admin) */}
            {!isPmRole && (
              <button
                type="button"
                disabled={contract.phase === "CLOSED"}
                onClick={() => {
                  setVatRateDraft(String(contract.vatRatePercent ?? 0))
                  setVatModalOpen(true)
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                title={
                  contract.phase === "CLOSED"
                    ? "Hợp đồng đã đóng sổ, không thể chỉnh thuế suất VAT"
                    : "Chỉnh sửa % thuế VAT áp dụng cho hợp đồng này"
                }
              >
                <span>Thuế VAT: {contract.vatRatePercent ?? 0}%</span>
              </button>
            )}

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
                          {four.bonusUnlockStatus === "DISBURSED" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                              ✓ Đã thực chi ({formatMoney(four.teamBonus50Vnd)})
                            </span>
                          ) : four.bonusUnlockStatus === "CLAWBACK_PENDING" ? (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 border border-amber-300">
                              ⚠ Cần đối trừ
                            </span>
                          ) : four.bonusUnlockStatus === "UNLOCKED" ? (
                            <span className="font-medium text-emerald-700">
                              +{formatMoney(four.teamBonus50Vnd)} (Đủ ĐK chi)
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
              const linkedInstallments = four.linkedInstallments
              const unpaidLinkedInstallments = linkedInstallments.filter(
                (i) => i.paymentStatus !== "PAID"
              )
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

                  {/* QUỸ THƯỞNG 50% & BƯỚC XÁC NHẬN THỰC CHI (CÁCH B) */}
                  {roleView !== "PM" && four.surplusMandays > 0 && (
                    <div
                      className={cn(
                        "rounded-lg border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs",
                        four.bonusUnlockStatus === "DISBURSED"
                          ? "border-emerald-300 bg-emerald-50/80 text-emerald-950"
                          : four.bonusUnlockStatus === "CLAWBACK_PENDING"
                            ? "border-amber-300 bg-amber-50 text-amber-950"
                            : four.bonusUnlockStatus === "UNLOCKED"
                              ? "border-emerald-200 bg-emerald-50/50 text-slate-900"
                              : "border-slate-200 bg-slate-50 text-slate-700"
                      )}
                    >
                      <div>
                        <span className="font-semibold">
                          Quỹ thưởng 50% Mốc {activeScope.code} (+{four.bonusSplit50Md} MD ={" "}
                          {formatMoney(four.teamBonus50Vnd)}):
                        </span>{" "}
                        {four.bonusUnlockStatus === "DISBURSED" ? (
                          <span className="font-semibold text-emerald-800">
                            Đã thực chi
                            {activeScope.bonusDisbursedAt
                              ? ` ngày ${activeScope.bonusDisbursedAt}`
                              : ""}
                          </span>
                        ) : four.bonusUnlockStatus === "CLAWBACK_PENDING" ? (
                          <span className="font-semibold text-amber-900">
                            ⚠ Mốc bị Reopen sau khi chi thưởng — Cần đối trừ khi Finish lại
                          </span>
                        ) : four.bonusUnlockStatus === "UNLOCKED" ? (
                          <span className="text-emerald-700 font-medium">
                            Đã mở khóa (Mốc Finish & Đợt TT đã PAID) • Chờ xác nhận thực chi
                          </span>
                        ) : four.bonusUnlockStatus === "PENDING_PAYMENT" ? (
                          <span className="text-amber-800 font-medium">
                            {unpaidLinkedInstallments.length > 0
                              ? `Mốc đã Finish • Chờ khách thanh toán: ${unpaidLinkedInstallments
                                  .map((i) => i.name.split("(")[0].trim())
                                  .join(", ")}`
                              : "Mốc đã Finish • Chờ thu đủ công nợ các Đợt thanh toán hợp đồng"}
                          </span>
                        ) : (
                          <span>Chờ hoàn thành Mốc & khách thanh toán Đợt liên kết</span>
                        )}
                      </div>

                      {four.bonusUnlockStatus === "UNLOCKED" && (
                        <Button
                          size="sm"
                          disabled={
                            !canConfirmBonusPayout ||
                            disburseBonusMutation.isPending
                          }
                          title={
                            canConfirmBonusPayout
                              ? "Kế toán/BOD xác nhận đã chuyển khoản thực chi thưởng 50%"
                              : "Chỉ Kế toán / BOD / Admin được xác nhận thực chi"
                          }
                          onClick={async () => {
                            try {
                              await disburseBonusMutation.mutateAsync({
                                id: activeScope.id,
                                data: {
                                  note: `Xác nhận đã thực chi thưởng 50% mốc ${activeScope.code}`,
                                },
                              })
                              invalidateCurrentContract()
                              toast.success(
                                `Đã xác nhận thực chi thưởng 50% cho ${activeScope.code}!`
                              )
                            } catch (err) {
                              const axiosErr = err as {
                                response?: {
                                  data?: { errors?: Array<{ message?: string }> }
                                }
                              }
                              toast.error(
                                axiosErr?.response?.data?.errors?.[0]?.message ||
                                  "Không thể xác nhận thực chi thưởng"
                              )
                            }
                          }}
                          className="h-7 px-2.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white"
                        >
                          ✓ Xác nhận Đã thực chi 50%
                        </Button>
                      )}
                    </div>
                  )}

                  {/* CÁC NÚT HÀNH ĐỘNG CHÍNH */}
                  {contract.phase === "PRE_PROJECT" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                      Dự án đang ở giai đoạn <strong>Chuẩn bị (PRE_PROJECT)</strong>. Vui lòng hoàn tất 4/4 Checklist & nhấn <strong>Start Dự Án</strong> trước khi Log Mandays hoặc Finish Mốc.
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      disabled={
                        contract.phase === "PRE_PROJECT" ||
                        contract.phase === "CLOSED" ||
                        isFinished
                      }
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
                        disabled={
                          contract.phase === "PRE_PROJECT" ||
                          contract.phase === "CLOSED"
                        }
                        onClick={async () => {
                          try {
                            await finishMutation.mutateAsync({
                              id: activeScope.id,
                              data: {
                                note: `Hoàn thành & nghiệm thu mốc ${activeScope.code}`,
                              },
                            })
                            invalidateCurrentContract()
                            toast.success(
                              `Đã chốt hoàn thành mốc ${activeScope.code}!`
                            )
                          } catch (err) {
                            const axiosErr = err as {
                              response?: {
                                data?: { errors?: Array<{ message?: string }> }
                              }
                            }
                            toast.error(
                              axiosErr?.response?.data?.errors?.[0]?.message ||
                                "Không thể Finish Mốc"
                            )
                          }
                        }}
                        className="h-9 px-3.5 text-xs border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 gap-1.5 font-semibold"
                      >
                        <IconCheck className="size-3.5" />
                        Chốt hoàn thành Mốc (Chia 50/50)
                      </Button>
                    ) : (
                      contract.phase !== "CLOSED" &&
                      roleView !== "PM" && (
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
                      disabled={
                        contract.phase === "PRE_PROJECT" ||
                        contract.phase === "CLOSED"
                      }
                      onClick={() => setAddCrMode(!addCrMode)}
                      className="h-9 px-3.5 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
                    >
                      <IconPlus className="size-3.5" />
                      Phát sinh / Hỗ trợ 0đ
                    </Button>

                    {contract.phase !== "CLOSED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditScopeMode(!editScopeMode)}
                        className="h-9 px-3 text-xs border-slate-200 text-slate-700 hover:bg-slate-50 sm:ml-auto"
                      >
                        {editScopeMode ? "Đóng sửa chỉ số" : "Sửa 4 chỉ số Mốc"}
                      </Button>
                    )}
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
                          onClick={async () => {
                            try {
                              await reopenMutation.mutateAsync({
                                id: activeScope.id,
                                data: {
                                  reason:
                                    reopenReason.trim() ||
                                    "Mở lại Mốc (Reopen) để xử lý bổ sung sau UAT",
                                },
                              })
                              invalidateCurrentContract()
                              toast.warning(
                                `Đã Reopen ${activeScope.code}!`
                              )
                              setReopenReason("")
                              setReopenModeOpen(false)
                            } catch (err) {
                              const axiosErr = err as {
                                response?: {
                                  data?: { errors?: Array<{ message?: string }> }
                                }
                              }
                              toast.error(
                                axiosErr?.response?.data?.errors?.[0]?.message ||
                                  "Không thể Reopen Mốc"
                              )
                            }
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
                        {roleView === "BOD" && (
                          <div>
                            <Label className="text-xs text-slate-600">
                              1. Trần tối đa (BOD cấp - ngày)
                            </Label>
                            <Input
                              type="number"
                              value={editLimitMd}
                              onChange={(e) => setEditLimitMd(e.target.value)}
                              className="h-9 text-sm bg-white mt-1"
                            />
                          </div>
                        )}
                        {roleView !== "PM" && (
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
                        )}
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
                            {four.bonusUnlockStatus === "DISBURSED"
                              ? "✓ Đã thực chi thưởng 50%"
                              : four.bonusUnlockStatus === "UNLOCKED"
                                ? "✓ Đã mở khóa — Đủ điều kiện chi ngay (Đợt liên kết đã PAID)"
                                : "Chi ngay 50% thưởng khi Mốc Finish và Đợt liên kết đạt PAID"}
                          </div>
                        </div>
                      </div>

                      {linkedInstallments.length > 0 ? (
                        <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Đợt thanh toán liên kết Mốc {activeScope.code} ({linkedInstallments.length})
                          </div>
                          {linkedInstallments.map((inst) => (
                            <div
                              key={inst.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200/80 bg-slate-50/70 px-3 py-2"
                            >
                              <div>
                                <strong className="text-slate-800">{inst.name}</strong>{" "}
                                <span className="font-mono text-slate-600">
                                  ({formatMoney(inst.amount)})
                                </span>
                                {inst.paymentStatus === "INVOICED" && (
                                  <span className="ml-2 text-[11px] text-amber-700 font-medium">
                                    • Đòi tiền
                                  </span>
                                )}
                                {inst.paymentStatus === "OVERDUE" && (
                                  <span className="ml-2 text-[11px] text-red-700 font-semibold">
                                    • Quá hạn TT
                                  </span>
                                )}
                              </div>
                              {inst.paymentStatus === "PAID" ? (
                                <span className="rounded bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 whitespace-nowrap shrink-0">
                                  ✓ Khách đã thanh toán ({inst.paidDate || "PAID"})
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    !canConfirmBonusPayout ||
                                    payInstallmentMutation.isPending
                                  }
                                  title={
                                    canConfirmBonusPayout
                                      ? "Xác nhận tiền đã về (PAID) để mở khóa thưởng 50%"
                                      : "Chỉ Kế toán / BOD / Admin được xác nhận tiền về"
                                  }
                                  className="h-8 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                                  onClick={async () => {
                                    if (!isUuidString(inst.id)) return
                                    try {
                                      await payInstallmentMutation.mutateAsync({
                                        id: inst.id,
                                      })
                                      invalidateCurrentContract()
                                      queryClient.invalidateQueries({
                                        queryKey: ["/api/v1/installments/queue"],
                                      })
                                      toast.success(
                                        `Đã xác nhận khách thanh toán "${inst.name}"!`
                                      )
                                    } catch (err) {
                                      const axiosErr = err as {
                                        response?: {
                                          data?: {
                                            errors?: Array<{ message?: string }>
                                          }
                                        }
                                      }
                                      toast.error(
                                        axiosErr?.response?.data?.errors?.[0]
                                          ?.message ||
                                          "Không thể xác nhận đã thu tiền"
                                      )
                                    }
                                  }}
                                >
                                  Xác nhận khách đã TT → Mở khóa thưởng
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                          Mốc này chưa gắn đợt thanh toán riêng — Quỹ thưởng 50% mở khóa khi thu đủ toàn bộ các đợt của hợp đồng.
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
                          const isApproved =
                            cr.status === "APPROVED_UPSELL" ||
                            cr.status === "APPROVED_FREE_GOODWILL"
                          const statusLabel =
                            cr.status === "APPROVED_FREE_GOODWILL"
                              ? "Đã duyệt hỗ trợ 0đ"
                              : cr.status === "APPROVED_UPSELL"
                                ? "Đã duyệt"
                                : cr.status === "REJECTED"
                                  ? "Từ chối"
                                  : "Chờ AM duyệt"
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
                              {(cr.status === "AM_QUOTING" ||
                                cr.status === "PM_ESTIMATING") &&
                              canApproveChangeRequest ? (
                                <Button
                                  size="sm"
                                  disabled={approvingCrId === cr.id}
                                  className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white whitespace-nowrap shrink-0"
                                  onClick={() => handleApproveChangeRequest(cr)}
                                >
                                  {approvingCrId === cr.id
                                    ? "Đang duyệt..."
                                    : "Duyệt phụ lục (+Trần ngày)"}
                                </Button>
                              ) : (
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 border",
                                    isApproved
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : cr.status === "REJECTED"
                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                        : "bg-amber-50 text-amber-800 border-amber-200"
                                  )}
                                >
                                  {isApproved && (
                                    <IconCheck className="size-3.5 shrink-0" />
                                  )}
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
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs text-emerald-900">
              Hệ thống <strong>tự động kiểm tra</strong> 4 điều kiện Pre-Project và <strong>bắt buộc khách đã thanh toán Tạm ứng Đợt 1 (PAID)</strong> ngay sau khi ký HĐ mới được bắt đầu dự án (tự chuyển sang Đang triển khai khi đủ điều kiện).
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={kickoffEval.isDriveReady}
                disabled={updateContractMutation.isPending}
                onCheckedChange={(v) => {
                  const val = Boolean(v)
                  void handlePersistKickoffPatch(
                    {
                      driveRootCreated: val,
                      driveTeamDocCreated: val,
                      driveSharedDocCreated: val,
                      drivePermissionsGranted: val,
                    },
                    { drive_permissions_verified: val }
                  )
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    1. Đã khởi tạo Google Drive chuẩn 3 thư mục & Phân quyền
                  </div>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-semibold shrink-0",
                      kickoffEval.isDriveReady
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {kickoffEval.autoChecks.drive
                      ? "Tự động đạt"
                      : kickoffEval.isDriveReady
                        ? "Đã xác nhận"
                        : "Còn thiếu"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                  <IconBrandGoogleDrive className="size-4 text-emerald-600 shrink-0" />
                  <span className="truncate">
                    {contract.googleDriveUrl?.trim()
                      ? contract.googleDriveUrl
                      : "Chưa gắn link Thư mục gốc Google Drive"}
                  </span>
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={kickoffEval.isProjectDocReady}
                disabled={updateContractMutation.isPending}
                onCheckedChange={(v) =>
                  void handlePersistKickoffPatch({
                    pmConfirmedScope: Boolean(v),
                  })
                }
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    2. PM đã xác nhận hiểu rõ phạm vi & Bảng 4 chỉ số Mốc bàn giao
                  </div>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-semibold shrink-0",
                      kickoffEval.isProjectDocReady
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {kickoffEval.autoChecks.scope
                      ? "Tự động đạt"
                      : kickoffEval.isProjectDocReady
                        ? "Đã xác nhận"
                        : "Còn thiếu"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Hiện có {contract.scopeItems.length} Mốc bàn giao trong dự án.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={kickoffEval.isTimelineReady}
                disabled={updateContractMutation.isPending}
                onCheckedChange={(v) =>
                  void handlePersistKickoffPatch({
                    kickoffTimelineConfirmed: Boolean(v),
                  })
                }
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    3. Đã chốt lộ trình & Lịch họp khởi động với Khách hàng
                  </div>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-semibold shrink-0",
                      kickoffEval.isTimelineReady
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {kickoffEval.autoChecks.timeline
                      ? "Tự động đạt"
                      : kickoffEval.isTimelineReady
                        ? "Đã xác nhận"
                        : "Còn thiếu"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Lộ trình: {contract.startDate || "—"} → {contract.expectedEndDate || "—"}
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3.5 cursor-pointer hover:bg-slate-50">
              <Checkbox
                checked={kickoffEval.isHandoverEstimateReady}
                disabled={updateContractMutation.isPending}
                onCheckedChange={(v) =>
                  void handlePersistKickoffPatch({
                    handoverEstimateConfirmed: Boolean(v),
                    handoverEstimateMandays: v ? totalHandoverEstMd || 4 : 0,
                  })
                }
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-900">
                    4. Đã tính đủ thời gian Bàn giao & Đào tạo trong cột 3. PM ước tính
                  </div>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-semibold shrink-0",
                      kickoffEval.isHandoverEstimateReady
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {kickoffEval.autoChecks.handover
                      ? "Tự động đạt"
                      : kickoffEval.isHandoverEstimateReady
                        ? "Đã xác nhận"
                        : "Còn thiếu"}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Tổng thời gian bàn giao đã tính: {totalHandoverEstMd} ngày.
                </div>
              </div>
            </label>

            {contract.phase === "PRE_PROJECT" && (
              <div className="pt-2 border-t border-slate-200 space-y-2.5">
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 space-y-1.5">
                  <div>
                    • Checklist khởi động:{" "}
                    <span className="font-semibold text-slate-900">{kickoffReadyCount}/4</span>
                  </div>
                  <div>
                    • Tạm ứng Đợt 1 (Bắt buộc):{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        metrics.isFirstInstallmentPaid
                          ? "text-emerald-700"
                          : "text-amber-700"
                      )}
                    >
                      {metrics.isFirstInstallmentPaid
                        ? "Đã thu tiền (PAID)"
                        : "Chưa thu tiền — Khách phải Tạm ứng sau khi ký HĐ"}
                    </span>
                  </div>
                </div>

                {!metrics.isFirstInstallmentPaid &&
                  contract.installments[0] &&
                  canConfirmBonusPayout && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={payInstallmentMutation.isPending}
                      onClick={async () => {
                        const firstInst = contract.installments[0]
                        if (!firstInst || !isUuidString(firstInst.id)) return
                        try {
                          const res = await payInstallmentMutation.mutateAsync({
                            id: firstInst.id,
                          })
                          invalidateCurrentContract()
                          const autoKickedOff = Boolean(
                            (res as { data?: { auto_kicked_off?: boolean } } | undefined)
                              ?.data?.auto_kicked_off
                          )
                          if (autoKickedOff) {
                            toast.success(
                              "Đã thu Tạm ứng Đợt 1 — Hệ thống tự động bắt đầu dự án (IN_PROJECT)!"
                            )
                            setKickoffDrawerOpen(false)
                          } else {
                            toast.success("Đã xác nhận thu Tạm ứng Đợt 1 (PAID)!")
                          }
                        } catch (err) {
                          const axiosErr = err as {
                            response?: {
                              data?: { errors?: Array<{ message?: string }> }
                            }
                          }
                          toast.error(
                            axiosErr?.response?.data?.errors?.[0]?.message ||
                              "Không thể xác nhận thu Tạm ứng Đợt 1"
                          )
                        }
                      }}
                      className="w-full h-9 text-xs border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 gap-1.5"
                    >
                      <IconCheck className="size-3.5" />
                      <span>Xác nhận Đã thu Tạm ứng Đợt 1 (PAID)</span>
                    </Button>
                  )}

                <Button
                  size="sm"
                  disabled={
                    !metrics.canKickoffToInProject || kickoffMutation.isPending
                  }
                  onClick={async () => {
                    try {
                      await kickoffMutation.mutateAsync({ id: contract.id })
                      invalidateCurrentContract()
                      toast.success(
                        "Đã Start Dự Án (Kick-off) chuyển sang giai đoạn In-Project!"
                      )
                      setKickoffDrawerOpen(false)
                    } catch (err) {
                      const axiosErr = err as {
                        response?: {
                          data?: { errors?: Array<{ message?: string }> }
                        }
                      }
                      toast.error(
                        axiosErr?.response?.data?.errors?.[0]?.message ||
                          "Chưa đủ điều kiện Start Dự Án"
                      )
                    }
                  }}
                  className="w-full h-9 text-xs gap-1.5"
                >
                  {metrics.canKickoffToInProject ? (
                    <>
                      <IconPlayerPlay className="size-3.5" />
                      <span>Start Dự Án (Kick-off sang In-Project)</span>
                    </>
                  ) : (
                    <>
                      <IconLock className="size-3.5" />
                      <span>Cần đủ 4/4 Checklist & Tạm ứng Đợt 1 để Start</span>
                    </>
                  )}
                </Button>
              </div>
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
                  handleUpdateHandoverDraft({
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
                  handleUpdateHandoverDraft({
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

            <div className="rounded-lg border border-slate-200 p-3.5 space-y-2.5">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={contract.handover.signedAcceptanceScanUploaded}
                  onCheckedChange={(v) =>
                    handleUpdateHandoverDraft({
                      signedAcceptanceScanUploaded: Boolean(v),
                    })
                  }
                />
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">
                    3. Đã tải lên Bản Scan Biên Bản Nghiệm Thu Tổng Thể
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Mốc đã hoàn thành: {metrics.acceptedScopeCount}/{metrics.totalScopeCount} • Đợt đã thu:{" "}
                    {paidInstallmentCount}/{contract.installments.length}
                  </div>
                  {contract.handover.acceptanceScanFileName && (
                    <div className="text-xs text-emerald-700 font-medium mt-1">
                      Tệp BBNT: {contract.handover.acceptanceScanFileName}
                    </div>
                  )}
                </div>
              </label>

              <div className="pl-7 flex items-center gap-2">
                <input
                  ref={bbntScanInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      await uploadScanMutation.mutateAsync({
                        data: {
                          file,
                          contract_id: contract.id,
                          category: "ACCEPTANCE",
                        },
                      })
                      handleUpdateHandoverDraft({
                        signedAcceptanceScanUploaded: true,
                        acceptanceScanFileName: file.name,
                      })
                      toast.success(`Đã đính kèm bản scan BBNT: ${file.name}`)
                    } catch {
                      toast.error(`Không thể tải tệp "${file.name}" lên máy chủ`)
                    }
                    e.target.value = ""
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={uploadScanMutation.isPending}
                  onClick={() => bbntScanInputRef.current?.click()}
                  className="h-7 text-xs gap-1.5"
                >
                  <IconUpload className="size-3.5" />
                  {uploadScanMutation.isPending ? "Đang tải..." : "Tải lên Bản Scan BBNT (PDF/Ảnh)"}
                </Button>
              </div>
            </div>

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
                  roleView === "PM" ||
                  closeContractMutation.isPending
                }
                onClick={async () => {
                  try {
                    await closeContractMutation.mutateAsync({
                      id: contract.id,
                      data: {
                        kpi_bonus_split_percent: 50,
                        handover: { ...contract.handover },
                      },
                    })
                    invalidateCurrentContract()
                    toast.success(
                      "Đã chốt quyết toán 50/50 & Đóng sổ Dự án thành công!"
                    )
                    setHandoverDrawerOpen(false)
                  } catch (err) {
                    const axiosErr = err as {
                      response?: {
                        data?: { errors?: Array<{ message?: string }> }
                      }
                    }
                    toast.error(
                      axiosErr?.response?.data?.errors?.[0]?.message ||
                        "Chưa đủ điều kiện Gatekeeper #2 để đóng dự án"
                    )
                  }
                }}
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
                    onClick={() => {
                      const currentTags = contract.amCustomTags || []
                      const nextTags = active
                        ? currentTags.filter((t) => t !== tag)
                        : Array.from(new Set([...currentTags, tag]))
                      void handleUpdateCustomTags(
                        nextTags,
                        active ? `Đã gỡ nhãn [${tag}]` : `Đã gắn nhãn [${tag}]`
                      )
                    }}
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
                  const nextTag = newTagDraft.trim()
                  const nextTags = Array.from(
                    new Set([...(contract.amCustomTags || []), nextTag])
                  )
                  void handleUpdateCustomTags(nextTags, `Đã gắn nhãn [${nextTag}]`)
                  setNewTagDraft("")
                }}
              >
                Thêm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG: SỬA % THUẾ VAT CỦA TỪNG HỢP ĐỒNG (AM / KẾ TOÁN / BOD / ADMIN) */}
      <Dialog open={vatModalOpen} onOpenChange={setVatModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Chỉnh sửa % Thuế VAT — {contract.contractCode}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Thay đổi thuế suất VAT sẽ tự động tính lại Tổng giá trị hợp đồng, Tiền thuế các đợt thanh toán, Credit Y và Đơn giá 1 MD động của dự án.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const parsedRate = Math.min(100, Math.max(0, Number(vatRateDraft) || 0))
            const totalBeforeVat = contract.scopeItems.reduce(
              (s, item) => s + Math.max(0, Number(item.amountBeforeVat || 0)),
              0
            )
            const previewVatTax = Math.round((totalBeforeVat * parsedRate) / 100)
            const previewBaseTotal = totalBeforeVat + previewVatTax
            const previewRisk = Math.round(
              (previewBaseTotal * (contract.riskReservePercent || 0)) / 100
            )
            const previewCreditY = Math.max(
              0,
              previewBaseTotal -
                (contract.fixedCostAllocation +
                  contract.salesCommissionAmount +
                  previewRisk)
            )
            const totalLimitMd = metrics.totalMaxMandays
            const previewMdRate =
              totalLimitMd > 0 && previewCreditY > 0
                ? Math.floor(previewCreditY / totalLimitMd)
                : 0

            return (
              <div className="space-y-4 py-2 text-xs">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">
                    Chọn nhanh hoặc nhập % thuế VAT (0% – 100%)
                  </Label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[0, 5, 8, 10].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setVatRateDraft(String(pct))}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
                          parsedRate === pct
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {pct === 0 ? "0% (Không VAT)" : `${pct}%`}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-32 pt-1">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={vatRateDraft}
                      onChange={(e) => setVatRateDraft(e.target.value)}
                      className="h-9 pr-7 text-sm font-semibold tabular-nums"
                    />
                    <span className="absolute right-2.5 top-[56%] -translate-y-1/2 text-slate-500 font-medium">
                      %
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tổng giá trị trước thuế (các Mốc):</span>
                    <strong className="tabular-nums text-slate-900">
                      {formatMoney(totalBeforeVat)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tiền thuế VAT ({parsedRate}%):</span>
                    <strong className="tabular-nums text-slate-900">
                      {formatMoney(previewVatTax)}
                    </strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-slate-700 font-medium">Tổng giá trị HĐ sau thuế:</span>
                    <strong className="tabular-nums text-primary">
                      {formatMoney(previewBaseTotal)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Credit Y dự kiến:</span>
                    <strong className="tabular-nums text-emerald-700">
                      {formatMoney(previewCreditY)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Đơn giá 1 MD mới ({totalLimitMd} MD):
                    </span>
                    <strong className="tabular-nums text-slate-900">
                      {formatMoney(previewMdRate)} / MD
                    </strong>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVatModalOpen(false)}
                  >
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={updateContractMutation.isPending}
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                    onClick={async () => {
                      try {
                        await updateContractMutation.mutateAsync({
                          id: contract.id,
                          data: { vat_rate_percent: parsedRate },
                        })
                        invalidateCurrentContract()
                        toast.success(
                          `Đã cập nhật thuế suất VAT hợp đồng thành ${parsedRate}%!`
                        )
                        setVatModalOpen(false)
                      } catch (err) {
                        const axiosErr = err as {
                          response?: {
                            data?: { errors?: Array<{ message?: string }> }
                          }
                        }
                        toast.error(
                          axiosErr?.response?.data?.errors?.[0]?.message ||
                            "Không thể cập nhật thuế suất VAT"
                        )
                      }
                    }}
                  >
                    {updateContractMutation.isPending
                      ? "Đang lưu..."
                      : `Lưu Thuế VAT (${parsedRate}%)`}
                  </Button>
                </DialogFooter>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
