import type { ContractDetailDto, ContractSummaryDto } from "@/lib/api/model"
import type {
  AmExpenseCategory,
  AmExpenseItem,
  BonusPayoutStatus,
  ChangeRequestItem,
  ChangeRequestStatus,
  ContractProject,
  CreditLogType,
  PaymentInstallment,
  PreKickoffChecklist,
  ProjectDocCategory,
  ProjectDocument,
  ProjectPhase,
  ScopeExecutionStatus,
  ScopeItem,
  ScopeProgressLog,
  VatCategory,
} from "@/lib/mock/am-types"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidString(value?: string | null): boolean {
  return Boolean(value && UUID_REGEX.test(value.trim()))
}

export function mapApiContractDetailToProject(dto: ContractDetailDto): ContractProject {
  const checklistRaw = (dto.kickoff_checklist || {}) as Partial<PreKickoffChecklist>
  const handoverRaw = (dto.handover || {}) as Record<string, unknown>

  const scopeItems: ScopeItem[] = (dto.scope_items || []).map((s, idx) => {
    const rawLogs = (s as unknown as { progress_logs?: Array<Record<string, unknown>> })
      .progress_logs
    const progressLogs: ScopeProgressLog[] = Array.isArray(rawLogs)
      ? rawLogs.map((lg, lIdx) => ({
          id: String(lg.log_id || `log-${idx}-${lIdx}`),
          updatedAt: String(lg.created_at || lg.check_date || "").slice(0, 16).replace("T", " "),
          updatedBy: String(lg.logged_by_name || "Hệ thống"),
          logType: (lg.log_type as CreditLogType) || "PERIODIC_CHECK",
          status:
            (s.execution_status === "BLOCKED"
              ? "DELAYED"
              : (s.execution_status as ScopeExecutionStatus)) || "IN_PROGRESS",
          deltaMandays: Number(lg.delta_mandays || 0),
          previousActualMandays: Number(lg.previous_actual_mandays || 0),
          newActualMandays: Number(lg.cumulative_mandays || 0),
          limitMandaysSnapshot:
            lg.limit_mandays_snapshot !== null && lg.limit_mandays_snapshot !== undefined
              ? Number(lg.limit_mandays_snapshot)
              : undefined,
          note: String(lg.note || ""),
          blockerNote: lg.blocker_note ? String(lg.blocker_note) : undefined,
        }))
      : []

    const rawDisbursedAt = (s as unknown as { bonus_disbursed_at?: string | null })
      .bonus_disbursed_at

    return {
      id: s.scope_item_id || `scope-${idx}`,
      code: s.code || `MỐC-0${idx + 1}`,
      title: s.title || "",
      moduleName: s.module_name || s.title || "Core",
      description: s.description || "",
      ownerPic: s.owner_pic || dto.pm_name || "PM Dự án",
      source: "BASELINE",
      amountBeforeVat: Number(s.amount_before_vat || 0),
      vatCategory: (s.vat_category as VatCategory) || "NON_VAT",
      limitMandays: Number(s.limit_mandays || 0),
      targetMandays: Number(s.target_mandays || 0),
      estimatedMandays: Number(s.estimated_mandays || 0),
      handoverEstimatedMandays: Number(s.handover_estimated_mandays || 0),
      actualMandays: Number(s.actual_mandays || 0),
      supportMandays: Number(s.support_mandays || 0),
      progressPercent: Number(s.progress_percent || 0),
      status:
        s.execution_status === "BLOCKED"
          ? "DELAYED"
          : (s.execution_status as ScopeExecutionStatus) || "NOT_STARTED",
      isAccepted: Boolean(s.is_accepted),
      bonusPayoutStatus: (s.bonus_payout_status as BonusPayoutStatus) || "LOCKED",
      bonusPaidAmountVnd:
        s.bonus_paid_amount !== null && s.bonus_paid_amount !== undefined
          ? Number(s.bonus_paid_amount)
          : undefined,
      bonusDisbursedAt: rawDisbursedAt ? String(rawDisbursedAt).slice(0, 10) : undefined,
      progressLogs,
    }
  })

  const scopeMap = new Map(scopeItems.map((s) => [s.id, s]))

  const installments: PaymentInstallment[] = (dto.installments || []).map((inst, idx) => {
    const rawInst = inst as unknown as {
      paid_date?: string | null
      vat_issued_date?: string | null
      vat_invoice_file_url?: string | null
    }
    const linkedIds = inst.linked_milestone_ids || []
    const linkedLabels = linkedIds
      .map((id) => scopeMap.get(id)?.code)
      .filter(Boolean)
      .join(" + ")
    const vatStatusRaw = inst.vat_invoice_status || "NOT_YET"
    const normalizedVatStatus =
      vatStatusRaw === "ISSUED"
        ? "ISSUED"
        : vatStatusRaw === "SENT_TO_ACCOUNTANT" || vatStatusRaw === "PENDING"
          ? "SENT_TO_ACCOUNTANT"
          : "NOT_YET"

    return {
      id: inst.installment_id || `inst-${idx}`,
      name: inst.label || inst.code || `Đợt ${idx + 1}`,
      percentage: Number(inst.percentage || 0),
      amount: Number(inst.amount_total || 0),
      vatAmount:
        Number(inst.vat_taxable_base_amount || 0) + Number(inst.vat_tax_amount || 0),
      nonVatAmount: Number(inst.non_vat_base_amount || 0),
      dueDate: inst.due_date ? String(inst.due_date).slice(0, 10) : "",
      linkedMilestoneId: linkedIds[0],
      linkedMilestoneIds: linkedIds,
      triggerMilestoneName: linkedLabels
        ? `Hoàn thành ${linkedLabels}`
        : "Theo tiến độ hợp đồng",
      paymentStatus:
        (inst.payment_status as PaymentInstallment["paymentStatus"]) || "PENDING",
      paidDate: rawInst.paid_date ? String(rawInst.paid_date).slice(0, 10) : undefined,
      vatInvoiceStatus: normalizedVatStatus,
      vatInvoiceNumber: inst.vat_invoice_number || undefined,
      vatInvoiceDate: rawInst.vat_issued_date
        ? String(rawInst.vat_issued_date).slice(0, 10)
        : undefined,
      vatInvoiceFileUrl: rawInst.vat_invoice_file_url || undefined,
    }
  })

  const changeRequests: ChangeRequestItem[] = (dto.change_requests || []).map(
    (rawCr, idx) => {
      const cr = rawCr as Record<string, unknown>
      const rawStatus = String(cr.status || "PM_ESTIMATING")
      const status: ChangeRequestStatus =
        rawStatus === "APPROVED_PAID"
          ? "APPROVED_UPSELL"
          : rawStatus === "PENDING_CLIENT_QUOTE"
            ? "AM_QUOTING"
            : (rawStatus as ChangeRequestStatus)
      const msId = cr.target_scope_item_id ? String(cr.target_scope_item_id) : undefined
      return {
        id: String(cr.change_request_id || `cr-${idx}`),
        code: String(cr.code || `CR-${idx + 1}`),
        milestoneId: msId,
        milestoneTitle: msId ? scopeMap.get(msId)?.title : undefined,
        crType: (cr.cr_type as ChangeRequestItem["crType"]) || "UPSELL",
        title: String(cr.title || ""),
        requestedDate: String(cr.requested_date || "").slice(0, 10),
        requestedByClientContact: String(cr.requested_by_client_contact || ""),
        description: String(cr.description || ""),
        devMandays: Number(cr.dev_mandays || 0),
        pmEstimatedMandays: Number(cr.pm_estimated_mandays || 0),
        amAllocatedToPmMandays: Number(cr.am_allocated_to_pm_mandays || 0),
        quotedPriceVnd: Number(cr.quoted_price_vnd || 0),
        vatCategory: (cr.vat_category as VatCategory) || "NON_VAT",
        timelineImpactDays: Number(cr.timeline_impact_days || 0),
        status,
        amNegotiationNote: String(cr.am_negotiation_note || ""),
        approvedDate: cr.approved_at ? String(cr.approved_at).slice(0, 10) : undefined,
      }
    }
  )

  const amExpenses: AmExpenseItem[] = (dto.am_expenses || []).map((rawExp, idx) => {
    const exp = rawExp as Record<string, unknown>
    const rawSt = String(exp.status || "PENDING_REIMBURSE")
    return {
      id: String(exp.expense_id || `exp-${idx}`),
      date: String(exp.expense_date || "").slice(0, 10),
      category: (exp.category as AmExpenseCategory) || "OTHER",
      description: String(exp.description || ""),
      milestoneCode: exp.scope_item_id ? scopeMap.get(String(exp.scope_item_id))?.code : undefined,
      amountVnd: Number(exp.amount_vnd || 0),
      status:
        rawSt === "REIMBURSED"
          ? "REIMBURSED"
          : rawSt === "RECORDED"
            ? "RECORDED"
            : "PENDING_REIMBURSE",
    }
  })

  const documents: ProjectDocument[] = (dto.documents || []).map((rawDoc, idx) => {
    const doc = rawDoc as Record<string, unknown>
    const docType = String(doc.doc_type || "OTHER")
    const category: ProjectDocCategory =
      docType === "CONTRACT_SCAN" || docType === "SCOPE_SRS" || docType === "CLIENT_INPUT"
        ? docType
        : "OTHER"
    return {
      id: String(doc.document_id || `doc-${idx}`),
      fileName: String(doc.title || "Tài liệu"),
      fileSize: String(doc.file_size || "PDF"),
      category,
      uploadedAt: String(doc.created_at || "").slice(0, 10),
      uploadedBy: String(doc.uploaded_by_name || "Hệ thống"),
    }
  })

  return {
    id: dto.contract_id || "",
    contractCode: dto.code || "",
    projectName: dto.name || "",
    customerId: dto.customer_id || "",
    customerName: dto.customer_name || "Khách hàng",
    signedDate: String(dto.signed_date || dto.start_date || "").slice(0, 10),
    startDate: String(dto.start_date || "").slice(0, 10),
    expectedEndDate: String(dto.end_date || "").slice(0, 10),
    amOwner: dto.am_name || "AM Phụ trách",
    pmOwner: dto.pm_name || "PM Dự án",
    phase: (dto.phase as ProjectPhase) || "PRE_PROJECT",
    checkCycleDays: (dto.check_cycle_days === 2 || dto.check_cycle_days === 5
      ? dto.check_cycle_days
      : 7) as 2 | 5 | 7,
    kickoffChecklist: {
      driveRootCreated: Boolean(checklistRaw.driveRootCreated),
      driveTeamDocCreated: Boolean(checklistRaw.driveTeamDocCreated),
      driveSharedDocCreated: Boolean(checklistRaw.driveSharedDocCreated),
      drivePermissionsGranted: Boolean(checklistRaw.drivePermissionsGranted),
      pmConfirmedScope: Boolean(checklistRaw.pmConfirmedScope),
      kickoffTimelineConfirmed: Boolean(checklistRaw.kickoffTimelineConfirmed),
      kickoffDate: checklistRaw.kickoffDate,
      handoverEstimateConfirmed: Boolean(checklistRaw.handoverEstimateConfirmed),
      handoverEstimateMandays: Number(checklistRaw.handoverEstimateMandays || 0),
    },
    documents,
    googleDriveUrl: dto.drive_root_url || "",
    drivePermissionsVerified: Boolean(dto.drive_permissions_verified),
    bodAllowKickoffWithoutAdvance: Boolean(dto.bod_allow_kickoff_without_advance),
    baseContractValue: Number(dto.base_contract_value || 0),
    approvedUpsellValue: Number(dto.approved_upsell_value || 0),
    fixedCostAllocation: Number(dto.fixed_cost_allocation || 0),
    salesCommissionAmount: Number(dto.sales_commission_amount || 0),
    riskReservePercent: Number(dto.risk_reserve_percent || 0),
    standardMandayRate: Number(dto.standard_manday_rate || 2_500_000),
    initialMaxMandays: Number(dto.initial_max_mandays || 0),
    upsellAddedMandays: Number(dto.upsell_added_mandays || 0),
    amTargetMandays: Number(dto.am_target_mandays || 0),
    pmEstimatedMandays: scopeItems.reduce((s, i) => s + Number(i.estimatedMandays || 0), 0),
    actualConsumedMandays: scopeItems.reduce((s, i) => s + Number(i.actualMandays || 0), 0),
    hasVatItems: Boolean(
      (dto as unknown as { has_vat_items?: boolean }).has_vat_items ??
        Number((dto as unknown as { vat_rate_percent?: number }).vat_rate_percent || 0) > 0
    ),
    hasNonVatItems: Boolean(
      (dto as unknown as { has_non_vat_items?: boolean }).has_non_vat_items ??
        Number((dto as unknown as { vat_rate_percent?: number }).vat_rate_percent || 0) === 0
    ),
    vatRatePercent: Number(
      (dto as unknown as { vat_rate_percent?: number }).vat_rate_percent ?? 0
    ),
    vatPortionAmount: Number(
      (dto as unknown as { vat_portion_amount?: number }).vat_portion_amount || 0
    ),
    nonVatPortionAmount: Number(
      (dto as unknown as { non_vat_portion_amount?: number }).non_vat_portion_amount || 0
    ),
    invoiceMethod: "BY_INSTALLMENT",
    externalAccountantNote: "",
    manualForceRedFlag: false,
    quickActionBlocker: "",
    installments,
    scopeItems,
    changeRequests,
    handover: {
      sourceCodeDelivered: Boolean(handoverRaw.sourceCodeDelivered),
      userGuideAndVideoDelivered: Boolean(handoverRaw.userGuideAndVideoDelivered),
      signedAcceptanceScanUploaded: Boolean(handoverRaw.signedAcceptanceScanUploaded),
      acceptanceScanFileName: handoverRaw.acceptanceScanFileName
        ? String(handoverRaw.acceptanceScanFileName)
        : undefined,
    },
    kpiBonusSplitPercent: 50,
    amAdvanceAmountVnd: Number(
      (dto as unknown as { am_advance_amount?: number }).am_advance_amount || 0
    ),
    amExpenses,
  }
}

export function mapApiContractSummaryToProject(dto: ContractSummaryDto): ContractProject {
  const synthScope: ScopeItem = {
    id: `sum-scope-${dto.contract_id}`,
    code: "TỔNG",
    title: "Tổng hợp các Mốc",
    moduleName: "Summary",
    description: "",
    source: "BASELINE",
    amountBeforeVat: Number(dto.base_contract_value || 0),
    vatCategory: "NON_VAT",
    limitMandays: Number(dto.total_limit_mandays || dto.initial_max_mandays || 0),
    targetMandays: Number(dto.total_target_mandays || dto.am_target_mandays || 0),
    estimatedMandays: Number(dto.total_estimated_mandays || 0),
    actualMandays: Number(dto.total_actual_mandays || 0),
    supportMandays: Number(dto.total_support_mandays || 0),
    isAccepted:
      Number(dto.scope_count || 0) > 0 &&
      Number(dto.accepted_scope_count || 0) === Number(dto.scope_count || 0),
  }

  return {
    id: dto.contract_id || "",
    contractCode: dto.code || "",
    projectName: dto.name || "",
    customerId: dto.customer_id || "",
    customerName: dto.customer_name || "Khách hàng",
    signedDate: String(dto.start_date || "").slice(0, 10),
    startDate: String(dto.start_date || "").slice(0, 10),
    expectedEndDate: String(dto.end_date || "").slice(0, 10),
    amOwner: dto.am_name || "AM Phụ trách",
    pmOwner: dto.pm_name || "PM Dự án",
    phase: (dto.phase as ProjectPhase) || "PRE_PROJECT",
    googleDriveUrl: "",
    drivePermissionsVerified: true,
    baseContractValue: Number(dto.base_contract_value || 0),
    approvedUpsellValue: Number(dto.approved_upsell_value || 0),
    fixedCostAllocation: Number(
      (dto as unknown as { fixed_cost_allocation?: number }).fixed_cost_allocation || 0
    ),
    salesCommissionAmount: Number(
      (dto as unknown as { sales_commission_amount?: number }).sales_commission_amount || 0
    ),
    riskReservePercent: Number(
      (dto as unknown as { risk_reserve_percent?: number }).risk_reserve_percent ?? 25
    ),
    standardMandayRate: Number(
      (dto as unknown as { standard_manday_rate?: number }).standard_manday_rate || 0
    ),
    initialMaxMandays: Number(dto.total_limit_mandays || dto.initial_max_mandays || 0),
    upsellAddedMandays: 0,
    amTargetMandays: Number(dto.total_target_mandays || dto.am_target_mandays || 0),
    pmEstimatedMandays: Number(dto.total_estimated_mandays || 0),
    actualConsumedMandays: Number(dto.total_actual_mandays || 0),
    hasVatItems: Boolean(
      (dto as unknown as { has_vat_items?: boolean }).has_vat_items ??
        Number((dto as unknown as { vat_rate_percent?: number }).vat_rate_percent || 0) > 0
    ),
    hasNonVatItems: Boolean(
      (dto as unknown as { has_non_vat_items?: boolean }).has_non_vat_items ??
        Number((dto as unknown as { vat_rate_percent?: number }).vat_rate_percent || 0) === 0
    ),
    vatRatePercent: Number(
      (dto as unknown as { vat_rate_percent?: number }).vat_rate_percent ?? 0
    ),
    vatPortionAmount: Number(
      (dto as unknown as { vat_portion_amount?: number }).vat_portion_amount || 0
    ),
    nonVatPortionAmount: Number(
      (dto as unknown as { non_vat_portion_amount?: number }).non_vat_portion_amount ||
        Number(dto.base_contract_value || 0)
    ),
    invoiceMethod: "BY_INSTALLMENT",
    externalAccountantNote: "",
    manualForceRedFlag: false,
    quickActionBlocker: "",
    installments: [],
    scopeItems: [synthScope],
    changeRequests: [],
    handover: {
      sourceCodeDelivered: false,
      userGuideAndVideoDelivered: false,
      signedAcceptanceScanUploaded: false,
    },
    kpiBonusSplitPercent: 50,
  }
}
