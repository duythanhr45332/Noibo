export type DemoRoleView = "AM" | "BOD" | "PM"

export type ScreenTab =
  | "dashboard"
  | "am-tasks"
  | "contracts"
  | "create-contract"
  | "project-detail"
  | "change-requests"
  | "billing-vat"
  | "am-expenses"
  | "customers"

export type ProjectDetailTab = "pre-project" | "in-project" | "post-project"

export type ProjectPhase = "PRE_PROJECT" | "IN_PROJECT" | "POST_PROJECT" | "CLOSED"

export type HealthStatus = "GREEN" | "YELLOW" | "RED"

export type InvoiceMethod = "BY_INSTALLMENT" | "LUMP_SUM_ON_ACCEPTANCE"

export type VatCategory = "NON_VAT" | "VAT_8" | "VAT_10"

export interface CustomerContact {
  name: string
  title: string
  phone: string
  email: string
}

export interface Customer {
  id: string
  code: string
  companyName: string
  taxCode: string
  industry: string
  address: string
  note?: string
  techContact: CustomerContact
  accountingContact: CustomerContact
  createdAt: string
}

export interface PaymentInstallment {
  id: string
  name: string
  percentage: number
  amount: number
  vatAmount: number
  nonVatAmount: number
  dueDate: string
  linkedMilestoneId?: string // Liên kết 1-1 hoặc 1-N với Mốc bàn giao
  linkedMilestoneIds?: string[] // Liên kết N-1: Phải hoàn thành cả M1 + M2 mới thu Đợt này
  triggerMilestoneName: string
  paymentStatus: "PENDING" | "INVOICED" | "PAID" | "OVERDUE"
  paidDate?: string
  vatInvoiceStatus: "NOT_YET" | "SENT_TO_ACCOUNTANT" | "ISSUED"
  vatInvoiceNumber?: string
  vatInvoiceDate?: string
  vatInvoiceFileUrl?: string
}

export type AmExpenseCategory =
  | "TAXI"
  | "SHIP"
  | "SHIPPING"
  | "HOSPITALITY"
  | "CLIENT_MEETING"
  | "PRINTING"
  | "OTHER"

export interface AmExpenseItem {
  id: string
  date: string
  category: AmExpenseCategory
  description: string
  milestoneCode?: string
  amountVnd: number
  status: "RECORDED" | "PENDING_REIMBURSE" | "REIMBURSED"
  createdBy?: string
}

export type ScopeExecutionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "DELAYED"

export type CreditLogType =
  | "PERIODIC_CHECK"
  | "FINISH_MILESTONE"
  | "REOPEN_MILESTONE"
  | "DISBURSE_BONUS"
  | "FREE_SUPPORT"
  | "UPSELL_ADDED"

export type BonusPayoutStatus =
  | "LOCKED"
  | "ELIGIBLE"
  | "DISBURSED"
  | "CLAWBACK_PENDING"

export interface ScopeProgressLog {
  id: string
  updatedAt: string // Ngày giờ check (VD: "2026-10-28 15:30")
  updatedBy: string // Người kiểm tra/ghi nhận (VD: "AM Thảo" hoặc "PM Minh Quân")
  logType?: CreditLogType
  status: ScopeExecutionStatus
  deltaMandays?: number // Số Mandays tiêu hao đợt này (+5 MD)
  previousActualMandays: number
  newActualMandays: number
  limitMandaysSnapshot?: number
   previousProgressPercent?: number
  newProgressPercent?: number
  note?: string // Lý do tiêu hao / Nội dung công việc đã kiểm tra
  blockerNote?: string
}

/**
 * Mốc bàn giao kỹ thuật (Scope Milestone) - Độc lập với Đợt thanh toán.
 * Quản lý theo mô hình Tài khoản tín dụng (In/Out Credit Balance) & 4 chỉ số tài chính:
 * 1. Limit (limitMandays): Hạn mức công ty cấp
 * 2. Target (targetMandays): Mục tiêu AM ép tiến độ (luôn <= Limit)
 * 3. Estimate (estimatedMandays): Dự toán kỹ thuật của PM (gồm cả thời gian bàn giao)
 * 4. Real (actualMandays): Thực tế tiêu hao (Log Mandays định kỳ)
 */
export interface ScopeItem {
  id: string
  code: string
  title: string
  moduleName: string
  description: string
  ownerPic?: string // Người phụ trách bàn giao riêng cho Mốc này (VD: Anh Du - Foundation, Anh Thanh - Đào tạo)
  source: "BASELINE" | "UPSELL_CR" | "FREE_GOODWILL"
  crId?: string
  amountBeforeVat: number // Giá trị tiền trước thuế phân bổ của mốc
  vatCategory: VatCategory

  // 4 Chỉ số Tài chính của Mốc (Milestone Finance)
  limitMandays?: number // 1. Limit: Hạn mức công ty cấp cho Mốc
  targetMandays?: number // 2. Target: Mục tiêu AM ép tiến độ giao PM (nhỏ hơn Limit)
  estimatedMandays: number // 3. Estimate: Dự toán kỹ thuật của PM
  handoverEstimatedMandays?: number // Thời gian bàn giao, họp nghiệm thu, HDSD đã tính trong Estimate
  actualMandays?: number // 4. Real: Số Mandays thực tế đã tiêu hao tại Mốc này
  supportMandays?: number // Cột riêng: Số Mandays Hỗ trợ 0đ (1:1, <= 1 MD Dev/mốc, không trừ vào Real hay thưởng 50/50)

  // Trạng thái & Lịch sử Log Mandays (Audit Log)
  dueDate?: string
  lastCheckDate?: string // Ngày check Mandays gần nhất (để nhắc AM nếu quá 3-5 ngày chưa cập nhật)
  finishedAt?: string // Ngày bấm "Finish Milestone"
  status?: ScopeExecutionStatus
  progressPercent?: number
  pmNote?: string
  blockerNote?: string
  progressLogs?: ScopeProgressLog[]
  isAccepted: boolean
  acceptedDate?: string
  acceptanceNote?: string
  bonusPayoutStatus?: BonusPayoutStatus
  bonusDisbursedAt?: string
  bonusPaidAmountVnd?: number
}

export type ChangeRequestType = "UPSELL" | "FREE_SUPPORT"

export type ChangeRequestStatus =
  | "PM_ESTIMATING"
  | "AM_QUOTING"
  | "APPROVED_UPSELL"
  | "APPROVED_FREE_GOODWILL"
  | "REJECTED"

export interface ChangeRequestItem {
  id: string
  code: string
  milestoneId?: string // Tích hợp thẳng vào từng Mốc đang chạy
  milestoneTitle?: string
  crType?: ChangeRequestType // UPSELL (Có tính tiền) | FREE_SUPPORT (Hỗ trợ 0 đồng)
  title: string
  requestedDate: string
  requestedByClientContact: string
  description: string
  devMandays?: number // Số ngày công của Dev (Hỗ trợ 0đ: tỉ lệ 1:1, lũy kế tối đa 1 MD Dev theo từng Mốc)
  pmEstimatedMandays: number // Tổng số ngày công thực tế (Upsell gồm Dev+Test+BG; Hỗ trợ 0đ theo tỉ lệ 1:1)
  amAllocatedToPmMandays?: number // Số MD AM cấp thêm vào Target của Mốc khi duyệt Upsell
  quotedPriceVnd: number // Giá báo khách (0đ nếu là FREE_SUPPORT)
  vatCategory: VatCategory
  timelineImpactDays: number
  status: ChangeRequestStatus
  amNegotiationNote: string
  approvedDate?: string
}

export interface PreKickoffChecklist {
  // 1. Check Google Drive (3 thư mục con + Phân quyền)
  driveRootCreated: boolean // Thư mục gốc hợp đồng
  driveTeamDocCreated: boolean // Thư mục tài liệu nội bộ (Team Document)
  driveSharedDocCreated: boolean // Thư mục chia sẻ cho khách (Shared Document)
  drivePermissionsGranted: boolean // Đã phân quyền đúng cho AM, PM, Dev và khách
  // 2. Project Document (Yêu cầu nghiệp vụ)
  pmConfirmedScope: boolean // PM đã xác nhận hiểu đúng Scope chưa?
  // 3. Timeline chuẩn
  kickoffTimelineConfirmed: boolean // Đã có lịch Kick-off & Đã chốt Scope với khách chưa?
  kickoffDate?: string
  // 4. Ước tính phần Bàn giao (Handover Estimate)
  handoverEstimateConfirmed: boolean // PM đã estimate cả thời gian bàn giao, họp nghiệm thu, HDSD chưa?
  handoverEstimateMandays: number // Số MD dự kiến cho việc bàn giao/nghiệm thu/HDSD
}

export interface HandoverChecklist {
  sourceCodeDelivered: boolean
  userGuideAndVideoDelivered: boolean
  signedAcceptanceScanUploaded: boolean
  acceptanceScanFileName?: string
}

export type ProjectDocCategory =
  | "CONTRACT_SCAN"
  | "SCOPE_SRS"
  | "CLIENT_INPUT"
  | "OTHER"

export interface ProjectDocument {
  id: string
  fileName: string
  fileSize: string
  category: ProjectDocCategory
  uploadedAt: string
  uploadedBy: string
}

export interface ContractProject {
  id: string
  contractCode: string
  projectName: string
  customerId: string
  customerName: string
  signedDate: string
  startDate: string
  expectedEndDate: string
  amOwner: string
  pmOwner: string
  phase: ProjectPhase

  // Nhãn cảnh báo tự do của AM (Tagging / Label)
  amCustomTags?: string[]
  checkCycleDays?: 2 | 5 | 7 // Định kỳ 2 ngày, 5 ngày hoặc hàng tuần AM/PM vào Log Mandays
  lastCheckInDate?: string

  // Checklist khởi tạo bắt buộc trước khi Kick-off dự án / Mốc mới
  kickoffChecklist?: PreKickoffChecklist

  // Tài liệu lưu trữ trực tiếp trên hệ thống & Google Drive 3 thư mục
  documents?: ProjectDocument[]
  googleDriveUrl: string
  drivePermissionsVerified: boolean

  // Điều kiện Kick-off Pre -> In-Project
  bodAllowKickoffWithoutAdvance?: boolean

  // Cấu hình Tài chính & Công thức Credit (Do BOD/Sale thiết lập & duyệt cấp xuống cho AM)
  baseContractValue: number // X gốc (tự động cộng từ các hạng mục)
  approvedUpsellValue: number // Cộng thêm từ CR Upsell
  fixedCostAllocation: number // Chi phí cố định (Chỉ BOD thấy)
  salesCommissionAmount: number // Hoa hồng Sales (Chỉ BOD thấy)
  riskReservePercent: number // Quỹ rủi ro công ty 20-30% (Chỉ BOD thấy)
  standardMandayRate: number // Đơn giá 1 Manday riêng tùy độ khó công nghệ của HĐ

  // 4 Chỉ số Mandays cấp Dự án (Tổng hợp từ các Mốc bàn giao)
  initialMaxMandays: number // 1. Limit gốc công ty cấp
  upsellAddedMandays: number // +k MD từ CR Upsell được duyệt
  amTargetMandays: number // 2. Target: Mục tiêu AM Thảo ép tiến độ giao PM
  pmEstimatedMandays: number // 3. Estimate: Dự toán kỹ thuật của PM
  actualConsumedMandays: number // 4. Real: Thực tế tiêu hao

  // Cấu hình Thuế & Hóa đơn
  hasVatItems: boolean
  hasNonVatItems: boolean
  vatRatePercent: number
  vatPortionAmount: number
  nonVatPortionAmount: number
  invoiceMethod: InvoiceMethod
  externalAccountantNote: string

  // Cảnh báo Sức khỏe & Hành động nhanh
  manualForceRedFlag: boolean
  manualRedFlagReason?: string
  quickActionBlocker: string

  // Danh sách con
  installments: PaymentInstallment[]
  scopeItems: ScopeItem[]
  changeRequests: ChangeRequestItem[]
  handover: HandoverChecklist

  // Quyết toán KPI khi Đóng dự án (Mặc định 50% bù rủi ro mốc sau / 50% chia thưởng)
  kpiBonusSplitPercent: number
  closedAt?: string
  closedBy?: string

  // Chi phí tạm ứng & công tác phí của AM (Taxi, Ship, Tiếp khách... - Độc lập với Quỹ Credit, dùng để Kế toán đối soát hoàn ứng)
  amAdvanceAmountVnd?: number // Số tiền công ty cấp tạm ứng trước cho AM (VD: 2.000.000đ)
  amExpenses?: AmExpenseItem[] // Danh sách các khoản AM đã thực chi
}

/**
 * Helper lấy đủ 4 chỉ số tài chính (Limit / Target / Estimate / Real) của 1 Mốc bàn giao
 */
export const FREE_SUPPORT_MAX_MD_PER_MILESTONE = 1

/**
 * Tính tổng số ngày công Hỗ trợ 0đ (1:1) đã ghi nhận trên một Mốc cụ thể
 */
export function getMilestoneFreeSupportUsedMd(
  contract: Pick<ContractProject, "changeRequests">,
  scopeId?: string
): number {
  if (!scopeId) return 0
  const sum = (contract.changeRequests || [])
    .filter(
      (cr) =>
        cr.milestoneId === scopeId &&
        (cr.crType === "FREE_SUPPORT" || cr.status === "APPROVED_FREE_GOODWILL") &&
        cr.status !== "REJECTED"
    )
    .reduce(
      (acc, cr) => acc + Number(cr.devMandays ?? cr.pmEstimatedMandays ?? 0),
      0
    )
  return Number(sum.toFixed(2))
}

/**
 * Tính Đơn giá 1 Manday động theo từng dự án (không cố định):
 * Đơn giá 1 MD = floor(Tổng Credit Y / Tổng Limit MD của dự án).
 */
export function getEffectiveMandayRate(contract: ContractProject): number {
  const baseVal = Number(contract.baseContractValue || 0)
  const riskPct = Math.min(100, Math.max(0, Number(contract.riskReservePercent || 0)))
  const riskReserveAmount = Math.round((baseVal * riskPct) / 100)
  const baseCreditY = Math.max(
    0,
    baseVal -
      (Number(contract.fixedCostAllocation || 0) +
        Number(contract.salesCommissionAmount || 0) +
        riskReserveAmount)
  )
  const upsellCreditY = Math.round(
    Number(contract.approvedUpsellValue || 0) * (1 - riskPct / 100)
  )
  const totalCreditY = baseCreditY + upsellCreditY

  const sumScopeLimits = (contract.scopeItems || []).reduce(
    (sum, s) => sum + Number(s.limitMandays ?? 0),
    0
  )
  const effectiveLimit =
    sumScopeLimits > 0
      ? sumScopeLimits
      : Number(contract.initialMaxMandays || 0) +
        Number(contract.upsellAddedMandays || 0)

  if (totalCreditY > 0 && effectiveLimit > 0) {
    return Math.floor(totalCreditY / effectiveLimit)
  }
  return Math.max(0, Number(contract.standardMandayRate || 0))
}

export function getMilestoneFourMetrics(
  item: ScopeItem,
  contract: ContractProject
) {
  const totalEst = Math.max(
    1,
    contract.scopeItems.reduce((s, i) => s + Number(i.estimatedMandays || 0), 0)
  )
  const contractTotalLimit = contract.initialMaxMandays + contract.upsellAddedMandays

  // 1. Limit (Hạn mức công ty cấp cho Mốc)
  const limitMandays =
    item.limitMandays !== undefined
      ? item.limitMandays
      : Math.max(
          item.estimatedMandays,
          Math.round((item.estimatedMandays / totalEst) * contractTotalLimit)
        )

  // 2. Target (Mục tiêu AM ép tiến độ cho Mốc, luôn <= Limit)
  const targetMandays =
    item.targetMandays !== undefined
      ? item.targetMandays
      : Math.min(
          limitMandays,
          Math.max(
            1,
            Math.round((item.estimatedMandays / totalEst) * contract.amTargetMandays)
          )
        )

  // 3. Estimate (Dự toán kỹ thuật của PM)
  const estimateMandays = Number(item.estimatedMandays || 0)

  // 4. Real (Thực tế tiêu hao đã Log — không gộp Hỗ trợ 0đ)
  const realMandays = Number(item.actualMandays ?? 0)

  // Cột riêng: Hỗ trợ 0đ (tỉ lệ 1:1, lũy kế <= 1 MD Dev/mốc)
  const supportMandays =
    item.supportMandays !== undefined
      ? Number(item.supportMandays)
      : getMilestoneFreeSupportUsedMd(contract, item.id)

  // Số dư tín dụng còn lại so với Limit (In/Out Account Balance)
  const balanceVsLimitMandays = limitMandays - realMandays
  const balanceVsTargetMandays = targetMandays - realMandays

  const isOverLimit = realMandays > limitMandays
  const isOverTarget = realMandays > targetMandays
  const isFinished = item.status === "COMPLETED" || item.isAccepted

  // Khi Mốc hoàn thành (hoặc tạm tính), nếu Real < Limit -> Dôi dư:
  // 50% giữ lại bù rủi ro cho các mốc sau, 50% chia thưởng (Lead/PM, Dev, Sale/AM)
  const dynamicMandayRate = getEffectiveMandayRate(contract)
  const surplusMandays = limitMandays - realMandays
  const surplusValueVnd = surplusMandays * dynamicMandayRate
  const bonusSplit50Md =
    surplusMandays > 0 ? Math.round(surplusMandays * 0.5 * 10) / 10 : 0
  const riskReserve50Md =
    surplusMandays > 0
      ? Math.round((surplusMandays - bonusSplit50Md) * 10) / 10
      : 0
  const riskBuffer50Vnd = surplusValueVnd > 0 ? Math.round(surplusValueVnd * 0.5) : 0
  const teamBonus50Vnd =
    surplusValueVnd > 0 ? surplusValueVnd - riskBuffer50Vnd : 0

  // Tìm các Đợt thanh toán gắn với Mốc này (hỗ trợ cả 1-1, 1-N, N-1)
  const linkedInstallments = contract.installments.filter(
    (inst) =>
      inst.linkedMilestoneId === item.id ||
      (inst.linkedMilestoneIds && inst.linkedMilestoneIds.includes(item.id))
  )
  const isLinkedPaymentPaid =
    linkedInstallments.length > 0
      ? linkedInstallments.every((inst) => inst.paymentStatus === "PAID")
      : contract.installments.length > 0 &&
        contract.installments.every((inst) => inst.paymentStatus === "PAID")

  // Cách B: Mở khóa 50% thưởng khi Mốc đã Finish VÀ Đợt liên kết đã PAID; kế toán xác nhận Thực chi (DISBURSED)
  const bonusUnlockStatus:
    | "OVER_LIMIT"
    | "IN_PROGRESS"
    | "PENDING_PAYMENT"
    | "UNLOCKED"
    | "DISBURSED"
    | "CLAWBACK_PENDING" =
    item.bonusPayoutStatus === "CLAWBACK_PENDING"
      ? "CLAWBACK_PENDING"
      : item.bonusPayoutStatus === "DISBURSED"
        ? "DISBURSED"
        : surplusMandays <= 0
          ? "OVER_LIMIT"
          : !isFinished
            ? "IN_PROGRESS"
            : isLinkedPaymentPaid || item.bonusPayoutStatus === "ELIGIBLE"
              ? "UNLOCKED"
              : "PENDING_PAYMENT"

  return {
    limitMandays,
    targetMandays,
    estimateMandays,
    realMandays,
    supportMandays,
    balanceVsLimitMandays,
    balanceVsTargetMandays,
    isOverLimit,
    isOverTarget,
    isFinished,
    surplusMandays,
    surplusValueVnd,
    bonusSplit50Md,
    riskReserve50Md,
    riskBuffer50Vnd,
    teamBonus50Vnd,
    linkedInstallments,
    isLinkedPaymentPaid,
    bonusUnlockStatus,
    limitValueVnd: limitMandays * dynamicMandayRate,
    targetValueVnd: targetMandays * dynamicMandayRate,
    estimateValueVnd: estimateMandays * dynamicMandayRate,
    realValueVnd: realMandays * dynamicMandayRate,
  }
}

/**
 * Kiểm tra & Tự động đánh giá Checklist Khởi tạo dự án trước khi Kick-off (Pre-Project Gatekeeper)
 * Tự động check dựa trên dữ liệu thực tế của Hợp đồng (Drive URL, Mốc bàn giao, Lộ trình ngày, Ước tính bàn giao)
 * kết hợp cùng trạng thái xác nhận thủ công.
 */
export function evaluateKickoffChecklist(contract: ContractProject) {
  const totalHandoverMd = (contract.scopeItems || []).reduce(
    (acc, s) => acc + Number(s.handoverEstimatedMandays ?? 0),
    0
  )
  const hasDriveUrl = Boolean(contract.googleDriveUrl?.trim())
  const hasValidScope =
    (contract.scopeItems || []).length > 0 &&
    (contract.scopeItems || []).some(
      (s) => Number(s.limitMandays ?? s.estimatedMandays ?? 0) > 0
    )
  const hasValidTimeline = Boolean(
    contract.startDate?.trim() && contract.expectedEndDate?.trim()
  )
  const hasHandoverEstimate = totalHandoverMd > 0

  const cl: PreKickoffChecklist = contract.kickoffChecklist || {
    driveRootCreated: contract.drivePermissionsVerified || hasDriveUrl,
    driveTeamDocCreated: contract.drivePermissionsVerified || hasDriveUrl,
    driveSharedDocCreated: contract.drivePermissionsVerified || hasDriveUrl,
    drivePermissionsGranted: contract.drivePermissionsVerified || hasDriveUrl,
    pmConfirmedScope: contract.phase !== "PRE_PROJECT" || hasValidScope,
    kickoffTimelineConfirmed: contract.phase !== "PRE_PROJECT" || hasValidTimeline,
    kickoffDate: contract.startDate,
    handoverEstimateConfirmed:
      contract.phase !== "PRE_PROJECT" || hasHandoverEstimate,
    handoverEstimateMandays: totalHandoverMd || 4,
  }

  const isDriveManualReady = Boolean(
    contract.drivePermissionsVerified ||
      (cl.driveRootCreated &&
        cl.driveTeamDocCreated &&
        cl.driveSharedDocCreated &&
        cl.drivePermissionsGranted)
  )
  const isDriveReady = hasDriveUrl || isDriveManualReady
  const isProjectDocReady = Boolean(cl.pmConfirmedScope) || hasValidScope
  const isTimelineReady = Boolean(cl.kickoffTimelineConfirmed) || hasValidTimeline
  const isHandoverEstimateReady =
    (Boolean(cl.handoverEstimateConfirmed) &&
      Number(cl.handoverEstimateMandays || 0) > 0) ||
    hasHandoverEstimate

  const completedCount = [
    isDriveReady,
    isProjectDocReady,
    isTimelineReady,
    isHandoverEstimateReady,
  ].filter(Boolean).length

  const isAllChecklistReady = completedCount === 4

  return {
    checklist: cl,
    isDriveReady,
    isProjectDocReady,
    isTimelineReady,
    isHandoverEstimateReady,
    autoChecks: {
      drive: hasDriveUrl,
      scope: hasValidScope,
      timeline: hasValidTimeline,
      handover: hasHandoverEstimate,
      totalHandoverMd,
    },
    completedCount,
    isAllChecklistReady,
  }
}

/**
 * Tính toán tổng thuế VAT từ danh sách Hạng mục hợp đồng (ScopeItems)
 */
export function calculateTaxBreakdownFromItems(
  items: Array<Pick<ScopeItem, "amountBeforeVat" | "vatCategory">>
) {
  let nonVatTotal = 0
  let vat8Base = 0
  let vat8Tax = 0
  let vat10Base = 0
  let vat10Tax = 0

  items.forEach((item) => {
    const amt = Number(item.amountBeforeVat || 0)
    if (item.vatCategory === "NON_VAT") {
      nonVatTotal += amt
    } else if (item.vatCategory === "VAT_8") {
      vat8Base += amt
      vat8Tax += Math.round(amt * 0.08)
    } else if (item.vatCategory === "VAT_10") {
      vat10Base += amt
      vat10Tax += Math.round(amt * 0.1)
    }
  })

  const vatBaseTotal = vat8Base + vat10Base
  const totalVatTax = vat8Tax + vat10Tax
  const grandTotalWithTax = nonVatTotal + vatBaseTotal + totalVatTax

  return {
    nonVatTotal,
    vat8Base,
    vat8Tax,
    vat10Base,
    vat10Tax,
    vatBaseTotal,
    totalVatTax,
    grandTotalWithTax,
  }
}

/**
 * Tính toán các chỉ số tài chính, 4 chỉ số Milestone Finance, 50/50 Bonus & Gatekeepers
 */
export function calculateContractMetrics(contract: ContractProject) {
  const totalContractValue = contract.baseContractValue + contract.approvedUpsellValue
  const riskReserveAmount = Math.round(
    (contract.baseContractValue * contract.riskReservePercent) / 100
  )
  const baseInternalCreditVnd = Math.max(
    0,
    contract.baseContractValue -
      (contract.fixedCostAllocation + contract.salesCommissionAmount + riskReserveAmount)
  )
  const effectiveMandayRate = getEffectiveMandayRate(contract)
  const upsellInternalCreditVnd = Math.round(
    contract.approvedUpsellValue *
      (1 - Math.min(100, Math.max(0, Number(contract.riskReservePercent || 0))) / 100)
  )
  const totalInternalCreditVnd = baseInternalCreditVnd + upsellInternalCreditVnd

  // Tổng hợp 4 chỉ số từ các Mốc bàn giao (hoặc cấp dự án)
  const milestoneMetricsList = contract.scopeItems.map((item) =>
    getMilestoneFourMetrics(item, contract)
  )

  const sumMilestoneLimit = milestoneMetricsList.reduce(
    (s, m) => s + m.limitMandays,
    0
  )
  const sumMilestoneTarget = milestoneMetricsList.reduce(
    (s, m) => s + m.targetMandays,
    0
  )
  const sumMilestoneEstimate = milestoneMetricsList.reduce(
    (s, m) => s + m.estimateMandays,
    0
  )
  const sumMilestoneReal = milestoneMetricsList.reduce(
    (s, m) => s + m.realMandays,
    0
  )

  const totalMaxMandays =
    sumMilestoneLimit > 0
      ? sumMilestoneLimit
      : contract.initialMaxMandays + contract.upsellAddedMandays
  const effectiveTargetMandays =
    sumMilestoneTarget > 0 ? sumMilestoneTarget : contract.amTargetMandays
  const effectiveEstimateMandays =
    sumMilestoneEstimate > 0 ? sumMilestoneEstimate : contract.pmEstimatedMandays
  const effectiveRealMandays =
    sumMilestoneReal > 0 || contract.scopeItems.some((s) => s.actualMandays !== undefined)
      ? sumMilestoneReal
      : contract.actualConsumedMandays

  const amBufferMandays = Math.max(0, totalMaxMandays - effectiveTargetMandays)
  const remainingCreditMandays = totalMaxMandays - effectiveRealMandays

  const burnVsTargetPercent =
    effectiveTargetMandays > 0
      ? Math.round((effectiveRealMandays / effectiveTargetMandays) * 100)
      : 0
  const burnVsMaxPercent =
    totalMaxMandays > 0
      ? Math.round((effectiveRealMandays / totalMaxMandays) * 100)
      : 0

  // Tiến độ hoàn thành các Mốc bàn giao (Finish Milestone)
  const totalScopeCount = contract.scopeItems.length
  const acceptedScopeCount = contract.scopeItems.filter(
    (item) => item.isAccepted || item.status === "COMPLETED"
  ).length
  const scopeAcceptancePercent =
    totalScopeCount > 0 ? Math.round((acceptedScopeCount / totalScopeCount) * 100) : 0

  // Công nợ & Thanh toán
  const totalPaidAmount = contract.installments
    .filter((i) => i.paymentStatus === "PAID")
    .reduce((sum, i) => sum + i.amount, 0)
  const overdueInstallments = contract.installments.filter(
    (i) => i.paymentStatus === "OVERDUE"
  )
  const dueOrOverdueInstallments = contract.installments.filter(
    (i) => i.paymentStatus === "OVERDUE" || i.paymentStatus === "INVOICED"
  )
  const overdueAmount = overdueInstallments.reduce((sum, i) => sum + i.amount, 0)
  const actionableDebtAmount = dueOrOverdueInstallments.reduce(
    (sum, i) => sum + i.amount,
    0
  )
  const isFirstInstallmentPaid =
    contract.installments.length > 0 &&
    contract.installments[0].paymentStatus === "PAID"

  const kickoffEval = evaluateKickoffChecklist(contract)
  // Quy tắc cứng: Khách BẮT BUỘC phải thanh toán Tạm ứng Đợt 1 (PAID) + đủ 4/4 Checklist Pre mới được Start dự án
  const canKickoffToInProject =
    isFirstInstallmentPaid && kickoffEval.isAllChecklistReady

  const isAllInstallmentsPaid =
    contract.installments.length > 0 &&
    contract.installments.every((i) => i.paymentStatus === "PAID")

  const isAllVatIssued =
    contract.installments.length > 0 &&
    contract.installments.every(
      (i) =>
        Number(i.vatAmount || 0) <= 0 ||
        (i.vatInvoiceStatus === "ISSUED" &&
          Boolean(i.vatInvoiceNumber?.trim()) &&
          Boolean(i.vatInvoiceFileUrl?.trim()))
    )

  const isHandoverComplete =
    contract.handover.sourceCodeDelivered &&
    contract.handover.userGuideAndVideoDelivered &&
    contract.handover.signedAcceptanceScanUploaded

  const amExpensesList = contract.amExpenses || []
  const unreimbursedExpensesCount = amExpensesList.filter(
    (exp) => exp.status !== "REIMBURSED"
  ).length
  const isAllAmExpensesReimbursed = unreimbursedExpensesCount === 0

  const canCloseProject =
    scopeAcceptancePercent === 100 &&
    isHandoverComplete &&
    isAllInstallmentsPaid &&
    isAllVatIssued &&
    isAllAmExpensesReimbursed

  // Cơ chế Phân bổ thưởng dôi dư chuẩn theo yêu cầu Sếp:
  // Nếu làm thực tế (Real) nhỏ hơn Limit -> Dôi dư ra tiền/mandays:
  // - 50% giữ lại bù rủi ro cho các mốc sau (nếu mốc sau bị trễ/âm)
  // - 50% còn lại chia thưởng cho Lead/PM, Dev và Sale/AM
  const surplusMandays = totalMaxMandays - effectiveRealMandays
  const surplusValueVnd = surplusMandays * effectiveMandayRate

  // Tính Quỹ bù rủi ro tích lũy từ các Mốc đã Finish có lời, trừ đi các Mốc bị âm
  let finishedMilestonesRiskPoolVnd = 0
  let finishedMilestonesBonusPoolVnd = 0
  let unlockedBonusPoolVnd = 0
  let pendingPaymentBonusPoolVnd = 0
  let unlockedBonusMd = 0
  let pendingPaymentBonusMd = 0
  let cumulativeRiskReserveMd = 0
  let milestonesOverLimitLossVnd = 0

  milestoneMetricsList.forEach((mm) => {
    if (mm.isFinished && mm.surplusValueVnd > 0) {
      finishedMilestonesRiskPoolVnd += mm.riskBuffer50Vnd
      finishedMilestonesBonusPoolVnd += mm.teamBonus50Vnd
      cumulativeRiskReserveMd =
        Math.round((cumulativeRiskReserveMd + mm.riskReserve50Md) * 10) / 10
      if (
        mm.bonusUnlockStatus === "UNLOCKED" ||
        mm.bonusUnlockStatus === "DISBURSED"
      ) {
        unlockedBonusPoolVnd += mm.teamBonus50Vnd
        unlockedBonusMd =
          Math.round((unlockedBonusMd + mm.bonusSplit50Md) * 10) / 10
      } else {
        pendingPaymentBonusPoolVnd += mm.teamBonus50Vnd
        pendingPaymentBonusMd =
          Math.round((pendingPaymentBonusMd + mm.bonusSplit50Md) * 10) / 10
      }
    } else if (mm.surplusValueVnd < 0) {
      milestonesOverLimitLossVnd += Math.abs(mm.surplusValueVnd)
      cumulativeRiskReserveMd =
        Math.round((cumulativeRiskReserveMd + mm.surplusMandays) * 10) / 10
    }
  })

  const netRiskPoolAfterMilestoneLossVnd =
    finishedMilestonesRiskPoolVnd - milestonesOverLimitLossVnd

  // Tính Sổ Tạm Ứng & Chi Phí Công Tác AM (Taxi, Ship, Tiếp khách... - Độc lập với Quỹ Credit)
  const amAdvanceVnd = Number(contract.amAdvanceAmountVnd || 0)
  const amTotalSpentVnd = amExpensesList.reduce(
    (sum, exp) => sum + Number(exp.amountVnd || 0),
    0
  )
  const amRemainingAdvanceVnd = Math.max(0, amAdvanceVnd - amTotalSpentVnd)
  const amReimburseNeededVnd = Math.max(0, amTotalSpentVnd - amAdvanceVnd)

  const isProfitable = surplusMandays > 0
  // Mặc định 50% giữ lại bù rủi ro / 50% chia thưởng theo chỉ đạo mới của Sếp
  const kpiBonusAmountVnd = isProfitable
    ? Math.round(surplusValueVnd * 0.5)
    : 0
  const maintenanceAndCompanyFundVnd = isProfitable
    ? surplusValueVnd - kpiBonusAmountVnd
    : 0
  const overBudgetLossVnd = !isProfitable ? Math.abs(surplusValueVnd) : 0
  const remainingRiskReserveAfterLossVnd = Math.max(
    0,
    riskReserveAmount - overBudgetLossVnd
  )

  // Thống kê Hỗ trợ 0 đồng (Free Support 1:1, tách cột riêng theo từng Mốc)
  const freeSupportCrs = contract.changeRequests.filter(
    (cr) =>
      (cr.crType === "FREE_SUPPORT" || cr.status === "APPROVED_FREE_GOODWILL") &&
      cr.status !== "REJECTED"
  )
  const totalFreeSupportCount = freeSupportCrs.length
  const totalFreeSupportDevMd = Number(
    freeSupportCrs
      .reduce(
        (s, cr) => s + Number(cr.devMandays ?? cr.pmEstimatedMandays ?? 0),
        0
      )
      .toFixed(2)
  )
  const totalFreeSupportRealMd = totalFreeSupportDevMd

  // Tính số ngày kể từ lần check Mandays gần nhất (để nhắc việc AM nếu quá 2-7 ngày chưa cập nhật)
  const todayRef = new Date()
  const latestCheckDateStr =
    contract.lastCheckInDate ||
    contract.scopeItems
      .map((s) => s.lastCheckDate || s.progressLogs?.[0]?.updatedAt?.slice(0, 10))
      .filter(Boolean)
      .sort()
      .reverse()[0] ||
    contract.startDate

  const latestCheckDateObj = new Date(latestCheckDateStr)
  const daysSinceLastCheck = Math.max(
    0,
    Math.floor(
      (todayRef.getTime() - latestCheckDateObj.getTime()) / (1000 * 60 * 60 * 24)
    )
  )
  const isCheckInOverdue =
    contract.phase === "IN_PROJECT" &&
    daysSinceLastCheck >= (contract.checkCycleDays || 3)

  // Kiểm tra các đợt thanh toán đã hoàn thành đủ các Mốc bàn giao liên kết (1-1, N-1, 1-N) nhưng chưa thu tiền
  const readyToBillInstallments = contract.installments.filter((inst) => {
    if (inst.paymentStatus === "PAID") return false
    const requiredIds =
      inst.linkedMilestoneIds && inst.linkedMilestoneIds.length > 0
        ? inst.linkedMilestoneIds
        : inst.linkedMilestoneId
        ? [inst.linkedMilestoneId]
        : []
    if (requiredIds.length === 0) return false
    return requiredIds.every((msId) => {
      const linkedMs = contract.scopeItems.find((s) => s.id === msId)
      return Boolean(
        linkedMs && (linkedMs.isAccepted || linkedMs.status === "COMPLETED")
      )
    })
  })

  // Tự động đánh giá Đèn Sức Khỏe (Báo động Đỏ ngay khi bất kỳ Mốc nào hoặc Dự án vượt Limit!)
  const delayedScopeItems = contract.scopeItems.filter((s) => s.status === "DELAYED")
  const overLimitMilestones = milestoneMetricsList.filter((m) => m.isOverLimit)
  const overTargetMilestones = milestoneMetricsList.filter((m) => m.isOverTarget)
  const hasDelayedMilestone = delayedScopeItems.length > 0
  const hasOverduePayment = overdueAmount > 0
  const isOverMaxCredit =
    effectiveRealMandays > totalMaxMandays || overLimitMilestones.length > 0
  const isOverAmTarget =
    effectiveRealMandays > effectiveTargetMandays || overTargetMilestones.length > 0
  const pendingCrs = contract.changeRequests.filter(
    (cr) => cr.status === "AM_QUOTING" || cr.status === "PM_ESTIMATING"
  )
  const hasPendingCrQuoting = pendingCrs.length > 0

  let healthStatus: HealthStatus = "GREEN"
  let healthReason =
    "Số dư tài khoản Credit Mandays của tất cả các Mốc đều nằm trong hạn mức an toàn."

  if (
    contract.manualForceRedFlag ||
    isOverMaxCredit ||
    hasDelayedMilestone ||
    hasOverduePayment
  ) {
    healthStatus = "RED"
    if (isOverMaxCredit) {
      healthReason = `BÁO ĐỘNG ĐỎ (ÂM QUỸ): Thực tế tiêu hao (${effectiveRealMandays} MD) vượt Limit công ty cấp (${totalMaxMandays} MD)!`
    } else if (contract.manualForceRedFlag && contract.manualRedFlagReason) {
      healthReason = contract.manualRedFlagReason
    } else if (hasDelayedMilestone) {
      healthReason = "Có Mốc bàn giao bị trễ hạn cam kết với khách hàng."
    } else if (hasOverduePayment) {
      healthReason = "Khách hàng quá hạn thanh toán đợt hợp đồng."
    }
  } else if (
    isOverAmTarget ||
    burnVsTargetPercent >= 85 ||
    hasPendingCrQuoting ||
    isCheckInOverdue
  ) {
    healthStatus = "YELLOW"
    if (isOverAmTarget) {
      healthReason = `Vượt Mốc ép Target AM giao PM (${effectiveRealMandays}/${effectiveTargetMandays} MD), đang tiêu vào khoảng đệm dự phòng.`
    } else if (hasPendingCrQuoting) {
      healthReason = "Đang có Yêu cầu phát sinh (Upsell) chờ chốt báo giá với khách."
    } else if (isCheckInOverdue) {
      healthReason = `Đã ${daysSinceLastCheck} ngày chưa Log Mandays định kỳ.`
    } else {
      healthReason = `Tiêu hao chạm ${burnVsTargetPercent}% hạn mức Target (${effectiveRealMandays}/${effectiveTargetMandays} MD).`
    }
  }

  // Tự động tổng hợp Action Blocker từ dữ liệu thật
  const autoBlockers: string[] = []
  if (isOverMaxCredit) {
    autoBlockers.push(
      `BÁO ĐỘNG ĐỎ: Âm quỹ Credit (${surplusMandays} MD so với Limit) — Cần khoanh vùng Scope ngay`
    )
  }
  if (overdueInstallments.length > 0) {
    autoBlockers.push(
      `Quá hạn thu ${overdueInstallments[0].name}`
    )
  }
  if (readyToBillInstallments.length > 0) {
    autoBlockers.push(
      `Mốc bàn giao đã Finish → Đòi tiền ${readyToBillInstallments[0].name}`
    )
  }
  if (delayedScopeItems.length > 0) {
    const sc = delayedScopeItems[0]
    autoBlockers.push(
      sc.blockerNote ? `Trễ ${sc.code}: ${sc.blockerNote}` : `Trễ mốc ${sc.title}`
    )
  }
  if (pendingCrs.length > 0) {
    autoBlockers.push(
      `Chờ khách duyệt báo giá Upsell ${pendingCrs[0].code} (+${pendingCrs[0].pmEstimatedMandays} MD)`
    )
  }
  if (isCheckInOverdue) {
    autoBlockers.push(`Quá ${daysSinceLastCheck} ngày chưa Log Mandays định kỳ`)
  }
  if (contract.phase === "PRE_PROJECT" && !canKickoffToInProject) {
    autoBlockers.push(
      `Hoàn tất Checklist Kick-off (${kickoffEval.completedCount}/4) & Tạm ứng Đợt 1 để Start dự án`
    )
  }
  if (contract.phase === "POST_PROJECT" && !canCloseProject) {
    const missingCloseParts: string[] = []
    if (scopeAcceptancePercent < 100) {
      missingCloseParts.push(`Finish Mốc (${acceptedScopeCount}/${totalScopeCount})`)
    }
    if (!isHandoverComplete) {
      missingCloseParts.push("Handover 3/3")
    }
    if (!isAllInstallmentsPaid || !isAllVatIssued) {
      missingCloseParts.push("Thu đủ PAID & xuất HĐ VAT")
    }
    if (!isAllAmExpensesReimbursed) {
      missingCloseParts.push(`${unreimbursedExpensesCount} khoản chi AM chưa REIMBURSED`)
    }
    autoBlockers.push(`Chờ ${missingCloseParts.join(", ")} để đóng dự án`)
  }

  const synthesizedActionBlocker =
    contract.quickActionBlocker?.trim() ||
    (autoBlockers.length > 0
      ? autoBlockers.join(" • ")
      : "Số dư Credit & Lịch bàn giao đang chạy tốt")

  const bonusSplitMandays = isProfitable
    ? Math.round(surplusMandays * 0.5 * 10) / 10
    : 0
  const riskReserveMandays = isProfitable
    ? Math.round((surplusMandays - bonusSplitMandays) * 10) / 10
    : 0

  return {
    totalContractValue,
    riskReserveAmount,
    baseInternalCreditVnd,
    upsellInternalCreditVnd,
    totalInternalCreditVnd,
    totalMaxMandays, // 1. Limit
    effectiveTargetMandays, // 2. Target
    effectiveEstimateMandays, // 3. Estimate
    totalMilestoneEstimateMd: effectiveEstimateMandays,
    effectiveRealMandays, // 4. Real
    isOverLimit: isOverMaxCredit,
    amBufferMandays,
    remainingCreditMandays,
    burnVsTargetPercent,
    burnVsMaxPercent,
    totalScopeCount,
    acceptedScopeCount,
    scopeAcceptancePercent,
    totalPaidAmount,
    overdueAmount,
    actionableDebtAmount,
    readyToBillInstallments,
    isFirstInstallmentPaid,
    kickoffEval,
    canKickoffToInProject,
    isAllInstallmentsPaid,
    isAllVatIssued,
    isHandoverComplete,
    unreimbursedExpensesCount,
    isAllAmExpensesReimbursed,
    canCloseProject,
    surplusMandays,
    surplusValueVnd,
    bonusSplitMandays,
    riskReserveMandays,
    finishedMilestonesRiskPoolVnd,
    finishedMilestonesBonusPoolVnd,
    unlockedBonusPoolVnd,
    pendingPaymentBonusPoolVnd,
    unlockedBonusMd,
    pendingPaymentBonusMd,
    cumulativeRiskReserveMd,
    milestonesOverLimitLossVnd,
    netRiskPoolAfterMilestoneLossVnd,
    amAdvanceVnd,
    amTotalSpentVnd,
    amRemainingAdvanceVnd,
    amReimburseNeededVnd,
    isProfitable,
    kpiBonusAmountVnd,
    maintenanceAndCompanyFundVnd,
    overBudgetLossVnd,
    remainingRiskReserveAfterLossVnd,
    totalFreeSupportCount,
    totalFreeSupportDevMd,
    totalFreeSupportRealMd,
    daysSinceLastCheck,
    latestCheckDateStr,
    isCheckInOverdue,
    healthStatus,
    healthReason,
    synthesizedActionBlocker,
  }
}

export function formatVnd(amount: number, hidePrice: boolean = false): string {
  if (hidePrice) {
    return "•••••••• ₫"
  }
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatCompactVnd(amount: number, hidePrice: boolean = false): string {
  if (hidePrice) {
    return "•••••• ₫"
  }
  const abs = Math.abs(amount)
  const sign = amount < 0 ? "-" : ""
  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(2).replace(/\.00$/, "")} tỷ`
  }
  if (abs >= 1_000_000) {
    return `${sign}${Math.round(abs / 1_000_000)} triệu`
  }
  return formatVnd(amount, false)
}
