"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  AmExpenseItem,
  calculateTaxBreakdownFromItems,
  ChangeRequestItem,
  ChangeRequestStatus,
  ContractProject,
  CreditLogType,
  Customer,
  DemoRoleView,
  formatCompactVnd,
  formatVnd,
  getMilestoneFourMetrics,
  HandoverChecklist,
  KeyMilestone,
  PaymentInstallment,
  PeriodicCheckIn,
  PreKickoffChecklist,
  ProjectDetailTab,
  ProjectDocument,
  ScopeExecutionStatus,
  ScopeItem,
  ScreenTab,
} from "@/lib/mock/am-types"
import {
  INITIAL_CONTRACTS,
  INITIAL_CUSTOMERS,
  MEETING_QUESTIONS_WITH_THAO,
} from "@/lib/mock/am-mock-data"

const STORAGE_KEY_CONTRACTS = "erp_am_prototype_contracts_v8"
const STORAGE_KEY_CUSTOMERS = "erp_am_prototype_customers_v3"
const STORAGE_KEY_NOTES = "erp_am_prototype_meeting_notes_v3"

interface AmPrototypeContextType {
  roleView: DemoRoleView
  setRoleView: (role: DemoRoleView) => void
  // Bảo mật ẩn giá tiền mặc định (Hide Price by Default)
  isPriceVisible: boolean
  setIsPriceVisible: (visible: boolean) => void
  togglePriceVisible: () => void
  hidePrice: boolean
  formatMoney: (amount: number) => string
  formatCompactMoney: (amount: number) => string

  activeScreen: ScreenTab
  setActiveScreen: (screen: ScreenTab) => void
  activeDetailTab: ProjectDetailTab
  setActiveDetailTab: (tab: ProjectDetailTab) => void
  selectedContractId: string
  setSelectedContractId: (id: string) => void
  selectedContract: ContractProject
  customers: Customer[]
  contracts: ContractProject[]
  meetingOpen: boolean
  setMeetingOpen: (open: boolean) => void
  meetingNotes: Record<string, string>
  updateMeetingNote: (questionId: string, note: string) => void
  openContractDetail: (contractId: string, tab?: ProjectDetailTab) => void
  createCustomer: (customer: Omit<Customer, "id" | "createdAt">) => Customer
  createContract: (newContract: ContractProject) => void
  updateContractPhase: (contractId: string, phase: ContractProject["phase"]) => void
  approveKickoffByBod: (contractId: string) => void
  toggleDriveVerified: (contractId: string, verified: boolean) => void
  updateKickoffChecklist: (
    contractId: string,
    patch: Partial<PreKickoffChecklist>
  ) => void
  addContractTag: (contractId: string, tag: string) => void
  removeContractTag: (contractId: string, tag: string) => void
  updateTargetMandays: (contractId: string, amTargetMandays: number) => void
  updateActionBlockerNote: (contractId: string, note: string) => void
  logMilestoneMandays: (
    contractId: string,
    scopeId: string,
    input: {
      deltaMandays?: number
      newCumulativeMandays?: number
      checkDate?: string
      note: string
      blockerNote?: string
      logType?: CreditLogType
    }
  ) => void
  finishMilestone: (contractId: string, scopeId: string, note?: string) => void
  updateMilestone: (contractId: string, milestoneId: string, patch: Partial<KeyMilestone>) => void
  addMilestone: (
    contractId: string,
    milestone: Omit<KeyMilestone, "id" | "order" | "updatedAt">
  ) => void
  removeMilestone: (contractId: string, milestoneId: string) => void
  addPeriodicCheckIn: (
    contractId: string,
    checkIn: Omit<PeriodicCheckIn, "id">,
    scopeProgressUpdates?: Array<{
      id: string
      progressPercent: number
      status: ScopeExecutionStatus
    }>
  ) => void
  addChangeRequest: (
    contractId: string,
    cr: Omit<ChangeRequestItem, "id" | "code">
  ) => void
  resolveChangeRequest: (
    contractId: string,
    crId: string,
    newStatus: ChangeRequestStatus,
    quotedPriceVnd?: number,
    amAllocatedToPmMandays?: number,
    autoCreateInstallment?: boolean,
    installmentDueDate?: string
  ) => void
  toggleScopeItemAccepted: (contractId: string, scopeId: string, isAccepted: boolean) => void
  acceptAllScopeItems: (contractId: string) => void
  addScopeItem: (contractId: string, item: Omit<ScopeItem, "id">) => void
  updateScopeItem: (contractId: string, scopeId: string, patch: Partial<ScopeItem>) => void
  removeScopeItem: (contractId: string, scopeId: string) => void
  updateInstallment: (
    contractId: string,
    installmentId: string,
    patch: Partial<PaymentInstallment>
  ) => void
  addInstallment: (
    contractId: string,
    installment: Omit<PaymentInstallment, "id">
  ) => void
  removeInstallment: (contractId: string, installmentId: string) => void
  addContractDocument: (
    contractId: string,
    doc: Omit<ProjectDocument, "id" | "uploadedAt">
  ) => void
  removeContractDocument: (contractId: string, docId: string) => void
  updateHandover: (contractId: string, patch: Partial<HandoverChecklist>) => void
  updateKpiSplitPercent: (contractId: string, percent: number) => void
  closeProjectAndSettleKpi: (contractId: string) => void
  updateAmAdvanceAmount: (contractId: string, amountVnd: number) => void
  addAmExpense: (contractId: string, expense: Omit<AmExpenseItem, "id">) => void
  toggleAmExpenseStatus: (contractId: string, expenseId: string) => void
  resetDemoData: () => void
}

const AmPrototypeContext = React.createContext<AmPrototypeContextType | undefined>(undefined)

export function AmPrototypeProvider({ children }: { children: React.ReactNode }) {
  const [roleView, setRoleView] = React.useState<DemoRoleView>("AM")
  // Mặc định ẨN toàn bộ giá tiền & manday rate (Hide Price by Default)
  const [isPriceVisible, setIsPriceVisible] = React.useState<boolean>(false)
  const [activeScreen, setActiveScreen] = React.useState<ScreenTab>("dashboard")
  const [activeDetailTab, setActiveDetailTab] = React.useState<ProjectDetailTab>("in-project")
  const [customers, setCustomers] = React.useState<Customer[]>(INITIAL_CUSTOMERS)
  const [contracts, setContracts] = React.useState<ContractProject[]>(INITIAL_CONTRACTS)
  const [selectedContractId, setSelectedContractId] = React.useState<string>(INITIAL_CONTRACTS[0].id)
  const [meetingOpen, setMeetingOpen] = React.useState<boolean>(false)
  const [meetingNotes, setMeetingNotes] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    MEETING_QUESTIONS_WITH_THAO.forEach((q) => {
      initial[q.id] = q.defaultNote
    })
    return initial
  })

  const hidePrice = roleView === "PM" || !isPriceVisible

  const togglePriceVisible = React.useCallback(() => {
    if (roleView === "PM") {
      toast.warning("Góc nhìn Technical PM không có quyền hiển thị số liệu tài chính!")
      return
    }
    setIsPriceVisible((prev) => {
      const next = !prev
      toast.info(
        next
          ? "Đã hiển thị số liệu tài chính (Giá trị HĐ & Đơn giá Manday)."
          : "Đã ẩn toàn bộ giá trị tiền (Chế độ bảo mật khi ngồi cạnh Khách/Dev)."
      )
      return next
    })
  }, [roleView])

  const formatMoney = React.useCallback(
    (amount: number) => formatVnd(amount, hidePrice),
    [hidePrice]
  )

  const formatCompactMoney = React.useCallback(
    (amount: number) => formatCompactVnd(amount, hidePrice),
    [hidePrice]
  )

  React.useEffect(() => {
    try {
      const savedContracts = localStorage.getItem(STORAGE_KEY_CONTRACTS)
      if (savedContracts) {
        const parsed = JSON.parse(savedContracts)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setContracts(parsed)
        }
      }
      const savedCustomers = localStorage.getItem(STORAGE_KEY_CUSTOMERS)
      if (savedCustomers) {
        const parsed = JSON.parse(savedCustomers)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomers(parsed)
        }
      }
      const savedNotes = localStorage.getItem(STORAGE_KEY_NOTES)
      if (savedNotes) {
        setMeetingNotes(JSON.parse(savedNotes))
      }
    } catch (e) {
      console.error("Failed to load prototype state", e)
    }
  }, [])

  const persistContracts = React.useCallback((next: ContractProject[]) => {
    setContracts(next)
    try {
      localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [])

  const persistCustomers = React.useCallback((next: Customer[]) => {
    setCustomers(next)
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOMERS, JSON.stringify(next))
    } catch {
      // ignore
    }
  }, [])

  const selectedContract = React.useMemo(() => {
    return contracts.find((c) => c.id === selectedContractId) || contracts[0]
  }, [contracts, selectedContractId])

  const openContractDetail = React.useCallback(
    (contractId: string, tab?: ProjectDetailTab) => {
      const target = contracts.find((c) => c.id === contractId)
      setSelectedContractId(contractId)
      setActiveScreen("project-detail")
      if (tab) {
        setActiveDetailTab(tab)
      } else if (target) {
        if (target.phase === "PRE_PROJECT") setActiveDetailTab("pre-project")
        else if (target.phase === "POST_PROJECT" || target.phase === "CLOSED")
          setActiveDetailTab("post-project")
        else setActiveDetailTab("in-project")
      }
    },
    [contracts]
  )

  const updateMeetingNote = React.useCallback((questionId: string, note: string) => {
    setMeetingNotes((prev) => {
      const next = { ...prev, [questionId]: note }
      try {
        localStorage.setItem(STORAGE_KEY_NOTES, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  const createCustomer = React.useCallback(
    (input: Omit<Customer, "id" | "createdAt">) => {
      const newCust: Customer = {
        ...input,
        id: `cust-${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      const next = [newCust, ...customers]
      persistCustomers(next)
      toast.success(`Đã thêm khách hàng: ${newCust.companyName}`)
      return newCust
    },
    [customers, persistCustomers]
  )

  const createContract = React.useCallback(
    (newContract: ContractProject) => {
      const next = [newContract, ...contracts]
      persistContracts(next)
      setSelectedContractId(newContract.id)
      setActiveScreen("project-detail")
      setActiveDetailTab("pre-project")
      toast.success(`Đã khởi tạo Hợp đồng ${newContract.contractCode}!`)
    },
    [contracts, persistContracts]
  )

  const updateContractPhase = React.useCallback(
    (contractId: string, phase: ContractProject["phase"]) => {
      const next = contracts.map((c) => (c.id === contractId ? { ...c, phase } : c))
      persistContracts(next)
      if (phase === "IN_PROJECT") {
        setActiveDetailTab("in-project")
        toast.success("Đã Start dự án (Kick-off) chuyển sang giai đoạn In-Project!")
      } else if (phase === "POST_PROJECT") {
        setActiveDetailTab("post-project")
        toast.success("Đã chuyển dự án sang giai đoạn Nghiệm thu (Post-Project)!")
      }
    },
    [contracts, persistContracts]
  )

  const approveKickoffByBod = React.useCallback(
    (contractId: string) => {
      const next = contracts.map((c) =>
        c.id === contractId
          ? {
              ...c,
              bodAllowKickoffWithoutAdvance: true,
            }
          : c
      )
      persistContracts(next)
      toast.success(
        "BOD đã duyệt ngoại lệ Tạm ứng Đợt 1! (Vui lòng hoàn tất đủ 4 mục Checklist Kick-off để Start dự án)"
      )
    },
    [contracts, persistContracts]
  )

  const toggleDriveVerified = React.useCallback(
    (contractId: string, verified: boolean) => {
      const next = contracts.map((c) =>
        c.id === contractId ? { ...c, drivePermissionsVerified: verified } : c
      )
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const updateKickoffChecklist = React.useCallback(
    (contractId: string, patch: Partial<PreKickoffChecklist>) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const current: PreKickoffChecklist = c.kickoffChecklist || {
          driveRootCreated: c.drivePermissionsVerified,
          driveTeamDocCreated: c.drivePermissionsVerified,
          driveSharedDocCreated: c.drivePermissionsVerified,
          drivePermissionsGranted: c.drivePermissionsVerified,
          pmConfirmedScope: false,
          kickoffTimelineConfirmed: false,
          kickoffDate: c.startDate,
          handoverEstimateConfirmed: false,
          handoverEstimateMandays: 3,
        }
        const merged = { ...current, ...patch }
        const driveDone =
          merged.driveRootCreated &&
          merged.driveTeamDocCreated &&
          merged.driveSharedDocCreated &&
          merged.drivePermissionsGranted
        return {
          ...c,
          drivePermissionsVerified: driveDone,
          kickoffChecklist: merged,
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const addContractTag = React.useCallback(
    (contractId: string, tag: string) => {
      const clean = tag.trim()
      if (!clean) return
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const existing = c.amCustomTags || []
        if (existing.includes(clean)) return c
        return {
          ...c,
          amCustomTags: [...existing, clean],
        }
      })
      persistContracts(next)
      toast.success(`Đã gắn nhãn [${clean}] cho hợp đồng!`)
    },
    [contracts, persistContracts]
  )

  const removeContractTag = React.useCallback(
    (contractId: string, tag: string) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          amCustomTags: (c.amCustomTags || []).filter((t) => t !== tag),
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const updateTargetMandays = React.useCallback(
    (contractId: string, amTargetMandays: number) => {
      const next = contracts.map((c) =>
        c.id === contractId ? { ...c, amTargetMandays } : c
      )
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const updateActionBlockerNote = React.useCallback(
    (contractId: string, note: string) => {
      const next = contracts.map((c) =>
        c.id === contractId ? { ...c, quickActionBlocker: note } : c
      )
      persistContracts(next)
      toast.success("Đã cập nhật ghi chú hành động nhanh cho dự án!")
    },
    [contracts, persistContracts]
  )

  /**
   * Ghi nhận tiêu hao Mandays định kỳ (In/Out Credit Account Balance) trên 1 Mốc bàn giao
   */
  const logMilestoneMandays = React.useCallback(
    (
      contractId: string,
      scopeId: string,
      input: {
        deltaMandays?: number
        newCumulativeMandays?: number
        checkDate?: string
        note: string
        blockerNote?: string
        logType?: CreditLogType
      }
    ) => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const datePart =
        input.checkDate ||
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      const formattedNow = `${datePart} ${pad(now.getHours())}:${pad(now.getMinutes())}`

      let overLimitTriggered = false
      let loggedDelta = 0
      let loggedNewTotal = 0
      let loggedLimit = 0

      const next = contracts.map((c) => {
        if (c.id !== contractId) return c

        const nextItems = c.scopeItems.map((s) => {
          if (s.id !== scopeId) return s
          const m4 = getMilestoneFourMetrics(s, c)
          const prevReal = m4.realMandays
          const nextReal =
            input.newCumulativeMandays !== undefined
              ? Math.max(0, Number(input.newCumulativeMandays))
              : Math.max(0, prevReal + Number(input.deltaMandays || 0))
          const delta = Number((nextReal - prevReal).toFixed(1))

          loggedDelta = delta
          loggedNewTotal = nextReal
          loggedLimit = m4.limitMandays

          if (nextReal > m4.limitMandays) {
            overLimitTriggered = true
          }

          const updatedByName =
            roleView === "PM"
              ? s.ownerPic || c.pmOwner || "PM Dự án"
              : roleView === "AM"
              ? c.amOwner || "AM Thảo"
              : "BOD Vũ Minh Hoàng"

          const nextStatus: ScopeExecutionStatus =
            s.status === "COMPLETED"
              ? "COMPLETED"
              : input.blockerNote?.trim()
              ? "DELAYED"
              : "IN_PROGRESS"

          return {
            ...s,
            actualMandays: nextReal,
            lastCheckDate: datePart,
            status: nextStatus,
            pmNote: input.note || s.pmNote,
            blockerNote:
              input.blockerNote !== undefined ? input.blockerNote : s.blockerNote,
            progressLogs: [
              {
                id: `log-${Date.now()}`,
                updatedAt: formattedNow,
                updatedBy: updatedByName,
                logType: input.logType || "PERIODIC_CHECK",
                status: nextStatus,
                deltaMandays: delta,
                previousActualMandays: prevReal,
                newActualMandays: nextReal,
                limitMandaysSnapshot: m4.limitMandays,
                note: input.note,
                blockerNote: input.blockerNote,
              },
              ...(s.progressLogs || []),
            ],
          }
        })

        const totalConsumed = nextItems.reduce(
          (sum, item) => sum + Number(item.actualMandays || 0),
          0
        )

        return {
          ...c,
          lastCheckInDate: datePart,
          actualConsumedMandays: totalConsumed,
          scopeItems: nextItems,
        }
      })

      persistContracts(next)
      if (overLimitTriggered) {
        toast.error(
          `BÁO ĐỘNG ĐỎ (ÂM QUỸ): Thực tế tiêu hao (${loggedNewTotal} MD) đã vượt Limit của Mốc (${loggedLimit} MD)!`
        )
      } else {
        toast.success(
          `Đã Log ${loggedDelta >= 0 ? `+${loggedDelta}` : loggedDelta} MD (Lũy kế Real: ${loggedNewTotal} / ${loggedLimit} MD Limit)!`
        )
      }
    },
    [contracts, persistContracts, roleView]
  )

  /**
   * Bấm "Finish Milestone" -> Chốt Mốc bàn giao và tự động tính Mandays dôi dư (Limit - Real)
   */
  const finishMilestone = React.useCallback(
    (contractId: string, scopeId: string, note?: string) => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      const formattedNow = `${today} ${pad(now.getHours())}:${pad(now.getMinutes())}`

      let surplusMd = 0
      let milestoneName = ""

      const next: ContractProject[] = contracts.map((c) => {
        if (c.id !== contractId) return c

        const nextItems = c.scopeItems.map((s): ScopeItem => {
          if (s.id !== scopeId) return s
          const m4 = getMilestoneFourMetrics(s, c)
          surplusMd = m4.limitMandays - m4.realMandays
          milestoneName = s.code

          const summaryNote =
            note?.trim() ||
            `Finish Milestone tại mức ${m4.realMandays}/${m4.limitMandays} MD Limit -> ${
              surplusMd >= 0
                ? `Dôi dư +${surplusMd} MD (50% giữ lại bù rủi ro mốc sau, 50% vào quỹ thưởng Team)`
                : `Âm quỹ ${surplusMd} MD so với Limit`
            }.`

          return {
            ...s,
            status: "COMPLETED",
            isAccepted: true,
            acceptedDate: today,
            finishedAt: today,
            lastCheckDate: today,
            progressPercent: 100,
            pmNote: summaryNote,
            progressLogs: [
              {
                id: `log-fin-${Date.now()}`,
                updatedAt: formattedNow,
                updatedBy: `${c.amOwner} & ${s.ownerPic || c.pmOwner}`,
                logType: "FINISH_MILESTONE",
                status: "COMPLETED",
                deltaMandays: 0,
                previousActualMandays: m4.realMandays,
                newActualMandays: m4.realMandays,
                limitMandaysSnapshot: m4.limitMandays,
                note: summaryNote,
              },
              ...(s.progressLogs || []),
            ],
          }
        })

        const allDone =
          nextItems.length > 0 &&
          nextItems.every((i) => i.isAccepted || i.status === "COMPLETED")
        const nextPhase: ContractProject["phase"] =
          c.phase === "CLOSED" || c.phase === "PRE_PROJECT"
            ? c.phase
            : allDone
            ? "POST_PROJECT"
            : "IN_PROJECT"

        return {
          ...c,
          phase: nextPhase,
          lastCheckInDate: today,
          scopeItems: nextItems,
        }
      })

      persistContracts(next)
      if (surplusMd >= 0) {
        toast.success(
          `Đã Finish ${milestoneName}! Hệ thống tự tính dôi dư +${surplusMd} MD (50% bù rủi ro mốc sau, 50% chia thưởng).`
        )
      } else {
        toast.warning(
          `Đã Finish ${milestoneName} với mức âm ${surplusMd} MD so với Limit (Sẽ khấu trừ vào Quỹ bù rủi ro).`
        )
      }
    },
    [contracts, persistContracts]
  )

  const updateMilestone = React.useCallback(
    (contractId: string, milestoneId: string, patch: Partial<KeyMilestone>) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          milestones: c.milestones.map((m) =>
            m.id === milestoneId
              ? { ...m, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
              : m
          ),
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const addMilestone = React.useCallback(
    (
      contractId: string,
      milestone: Omit<KeyMilestone, "id" | "order" | "updatedAt">
    ) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const nextOrder = c.milestones.length + 1
        return {
          ...c,
          milestones: [
            ...c.milestones,
            {
              ...milestone,
              id: `ms-${Date.now()}`,
              order: nextOrder,
              updatedAt: new Date().toISOString().slice(0, 10),
            },
          ],
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const removeMilestone = React.useCallback(
    (contractId: string, milestoneId: string) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          milestones: c.milestones
            .filter((m) => m.id !== milestoneId)
            .map((m, idx) => ({ ...m, order: idx + 1 })),
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const addPeriodicCheckIn = React.useCallback(
    (
      contractId: string,
      checkIn: Omit<PeriodicCheckIn, "id">,
      scopeProgressUpdates?: Array<{
        id: string
        progressPercent: number
        status: ScopeExecutionStatus
      }>
    ) => {
      const today = new Date().toISOString().slice(0, 10)
      const next: ContractProject[] = contracts.map((c) => {
        if (c.id !== contractId) return c
        const newCheckIn: PeriodicCheckIn = {
          ...checkIn,
          id: `chk-${Date.now()}`,
        }

        const updatedScopeItems: ScopeItem[] = scopeProgressUpdates
          ? c.scopeItems.map((s): ScopeItem => {
              const found = scopeProgressUpdates.find((u) => u.id === s.id)
              if (!found) return s
              const isDone =
                found.status === "COMPLETED" || found.progressPercent === 100
              return {
                ...s,
                status: isDone ? "COMPLETED" : found.status,
                progressPercent: isDone ? 100 : found.progressPercent,
                isAccepted: isDone,
                acceptedDate: isDone ? s.acceptedDate || today : undefined,
              }
            })
          : c.scopeItems

        return {
          ...c,
          lastCheckInDate: today,
          scopeItems: updatedScopeItems,
          actualConsumedMandays: checkIn.cumulativeActualMandays,
          manualForceRedFlag: checkIn.forceRedFlag,
          manualRedFlagReason: checkIn.forceRedFlag
            ? checkIn.blockerDescription || "PM bật cờ báo động Đỏ trong kỳ Check-in"
            : c.manualRedFlagReason,
          checkIns: [newCheckIn, ...c.checkIns],
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const addChangeRequest = React.useCallback(
    (contractId: string, cr: Omit<ChangeRequestItem, "id" | "code">) => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      const formattedNow = `${today} ${pad(now.getHours())}:${pad(now.getMinutes())}`

      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const isFreeSupport =
          cr.crType === "FREE_SUPPORT" || cr.status === "APPROVED_FREE_GOODWILL"
        const prefix = isFreeSupport ? "SUP" : "CR"
        const code = `${prefix}-0${c.changeRequests.length + 1}`
        const newCr: ChangeRequestItem = {
          ...cr,
          id: `cr-${Date.now()}`,
          code,
        }

        // Nếu là Phát sinh hỗ trợ 0 đồng -> Tự động Log luôn số Mandays thực tế vào Mốc đang chạy để trừ số dư & lưu bằng chứng!
        let nextScopeItems = c.scopeItems
        let nextConsumed = c.actualConsumedMandays

        if (isFreeSupport && cr.milestoneId) {
          nextScopeItems = c.scopeItems.map((s) => {
            if (s.id !== cr.milestoneId) return s
            const prevReal = Number(s.actualMandays || 0)
            const addedReal = Number(cr.pmEstimatedMandays || 0)
            const nextReal = Number((prevReal + addedReal).toFixed(1))
            return {
              ...s,
              actualMandays: nextReal,
              lastCheckDate: today,
              progressLogs: [
                {
                  id: `log-sup-${Date.now()}`,
                  updatedAt: formattedNow,
                  updatedBy: `${c.amOwner} (Ghi nhận Hỗ trợ 0đ)`,
                  logType: "FREE_SUPPORT",
                  status: s.status || "IN_PROGRESS",
                  deltaMandays: addedReal,
                  previousActualMandays: prevReal,
                  newActualMandays: nextReal,
                  limitMandaysSnapshot: s.limitMandays,
                  note: `[Hỗ trợ 0đ - ${code}] ${cr.title} (Dev: ${cr.devMandays ?? 1} MD -> Thực tế cả test/bàn giao: +${addedReal} MD)`,
                },
                ...(s.progressLogs || []),
              ],
            }
          })
          nextConsumed = nextScopeItems.reduce(
            (sum, i) => sum + Number(i.actualMandays || 0),
            0
          )
        }

        return {
          ...c,
          lastCheckInDate: today,
          actualConsumedMandays: nextConsumed,
          scopeItems: nextScopeItems,
          changeRequests: [newCr, ...c.changeRequests],
        }
      })
      persistContracts(next)
      if (cr.crType === "FREE_SUPPORT") {
        toast.info(
          `Đã Log Hỗ trợ 0đ (+${cr.pmEstimatedMandays} MD thực tế) vào Mốc & Lưu bằng chứng đàm phán cho AM!`
        )
      } else {
        toast.success("Đã ghi nhận Yêu cầu phát sinh (Upsell) vào Mốc!")
      }
    },
    [contracts, persistContracts]
  )

  const resolveChangeRequest = React.useCallback(
    (
      contractId: string,
      crId: string,
      newStatus: ChangeRequestStatus,
      quotedPriceVnd?: number,
      amAllocatedToPmMandays?: number,
      autoCreateInstallment: boolean = true,
      installmentDueDate?: string
    ) => {
      const today = new Date().toISOString().slice(0, 10)
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const targetCr = c.changeRequests.find((item) => item.id === crId)
        if (!targetCr) return c

        const wasAlreadyApprovedUpsell = targetCr.status === "APPROVED_UPSELL"
        const finalPrice =
          quotedPriceVnd !== undefined ? quotedPriceVnd : targetCr.quotedPriceVnd
        const allocatedToPm =
          amAllocatedToPmMandays !== undefined
            ? amAllocatedToPmMandays
            : targetCr.pmEstimatedMandays

        const updatedCrs = c.changeRequests.map((item) =>
          item.id === crId
            ? {
                ...item,
                status: newStatus,
                quotedPriceVnd: finalPrice,
                amAllocatedToPmMandays: allocatedToPm,
                approvedDate:
                  newStatus === "APPROVED_UPSELL" ||
                  newStatus === "APPROVED_FREE_GOODWILL"
                    ? today
                    : item.approvedDate,
              }
            : item
        )

        let nextUpsellValue = c.approvedUpsellValue
        let nextUpsellMandays = c.upsellAddedMandays
        let nextAmTargetMandays = c.amTargetMandays
        let nextScopeItems = [...c.scopeItems]
        const nextInstallments = [...c.installments]

        if (newStatus === "APPROVED_UPSELL" && !wasAlreadyApprovedUpsell) {
          nextUpsellValue += finalPrice
          nextUpsellMandays += targetCr.pmEstimatedMandays
          nextAmTargetMandays += allocatedToPm

          // Cộng thêm Limit & Target trực tiếp vào Mốc đang chạy (nếu CR gắn với Mốc)
          if (targetCr.milestoneId) {
            nextScopeItems = nextScopeItems.map((s) => {
              if (s.id !== targetCr.milestoneId) return s
              const m4 = getMilestoneFourMetrics(s, c)
              const nextLim = m4.limitMandays + targetCr.pmEstimatedMandays
              const nextTar = m4.targetMandays + allocatedToPm
              const nextEst = m4.estimateMandays + targetCr.pmEstimatedMandays
              return {
                ...s,
                limitMandays: nextLim,
                targetMandays: nextTar,
                estimatedMandays: nextEst,
                progressLogs: [
                  {
                    id: `log-up-${Date.now()}`,
                    updatedAt: `${today} 10:00`,
                    updatedBy: c.amOwner,
                    logType: "UPSELL_ADDED",
                    status: s.status || "IN_PROGRESS",
                    deltaMandays: 0,
                    previousActualMandays: m4.realMandays,
                    newActualMandays: m4.realMandays,
                    limitMandaysSnapshot: nextLim,
                    note: `[Duyệt Phụ lục Upsell ${targetCr.code}] Cộng +${targetCr.pmEstimatedMandays} MD vào Limit Mốc (Target giao PM +${allocatedToPm} MD).`,
                  },
                  ...(s.progressLogs || []),
                ],
              }
            })
          }

          if (autoCreateInstallment && finalPrice > 0) {
            const vatAmt =
              targetCr.vatCategory === "VAT_10"
                ? Math.round(finalPrice * 0.1)
                : targetCr.vatCategory === "VAT_8"
                ? Math.round(finalPrice * 0.08)
                : 0
            nextInstallments.push({
              id: `inst-upsell-${Date.now()}`,
              name: `Phụ lục Upsell (${targetCr.code}): ${targetCr.title}`,
              percentage: 0,
              amount: finalPrice,
              vatAmount: vatAmt,
              nonVatAmount: finalPrice - vatAmt,
              dueDate: installmentDueDate || c.expectedEndDate,
              linkedMilestoneId: targetCr.milestoneId,
              triggerMilestoneName: `Nghiệm thu Phụ lục Upsell ${targetCr.code}`,
              paymentStatus: "PENDING",
              vatInvoiceStatus: "NOT_YET",
            })
          }
        }

        return {
          ...c,
          approvedUpsellValue: nextUpsellValue,
          upsellAddedMandays: nextUpsellMandays,
          amTargetMandays: nextAmTargetMandays,
          changeRequests: updatedCrs,
          scopeItems: nextScopeItems,
          installments: nextInstallments,
        }
      })

      persistContracts(next)
      if (newStatus === "APPROVED_UPSELL") {
        toast.success(
          "Đã duyệt Phụ lục Upsell! Đã cộng thêm Limit & Target Mandays trực tiếp vào Mốc."
        )
      } else if (newStatus === "APPROVED_FREE_GOODWILL") {
        toast.info("Đã chuyển sang Hỗ trợ 0 đồng và ghi nhận vào bằng chứng hỗ trợ khách.")
      } else if (newStatus === "REJECTED") {
        toast.warning("Đã từ chối yêu cầu phát sinh.")
      }
    },
    [contracts, persistContracts]
  )

  const toggleScopeItemAccepted = React.useCallback(
    (contractId: string, scopeId: string, isAccepted: boolean) => {
      const today = new Date().toISOString().slice(0, 10)
      const next: ContractProject[] = contracts.map((c) => {
        if (c.id !== contractId) return c
        const nextItems = c.scopeItems.map((s): ScopeItem =>
          s.id === scopeId
            ? {
                ...s,
                isAccepted,
                status: isAccepted ? "COMPLETED" : "IN_PROGRESS",
                progressPercent: isAccepted ? 100 : 80,
                acceptedDate: isAccepted ? today : undefined,
                finishedAt: isAccepted ? s.finishedAt || today : undefined,
              }
            : s
        )
        const allAccepted =
          nextItems.length > 0 && nextItems.every((s) => s.isAccepted)
        const nextPhase: ContractProject["phase"] =
          c.phase === "CLOSED" || c.phase === "PRE_PROJECT"
            ? c.phase
            : allAccepted
            ? "POST_PROJECT"
            : "IN_PROJECT"
        return {
          ...c,
          phase: nextPhase,
          scopeItems: nextItems,
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const acceptAllScopeItems = React.useCallback(
    (contractId: string) => {
      const today = new Date().toISOString().slice(0, 10)
      const next: ContractProject[] = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          phase:
            c.phase === "CLOSED" || c.phase === "PRE_PROJECT"
              ? c.phase
              : "POST_PROJECT",
          scopeItems: c.scopeItems.map(
            (s): ScopeItem => ({
              ...s,
              isAccepted: true,
              status: "COMPLETED",
              progressPercent: 100,
              acceptedDate: s.acceptedDate || today,
              finishedAt: s.finishedAt || today,
            })
          ),
        }
      })
      persistContracts(next)
      toast.success("Đã Finish & Nghiệm thu 100% các Mốc bàn giao!")
    },
    [contracts, persistContracts]
  )

  const addScopeItem = React.useCallback(
    (contractId: string, item: Omit<ScopeItem, "id">) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const nextItems: ScopeItem[] = [
          ...c.scopeItems,
          {
            ...item,
            id: `sc-${Date.now()}`,
          },
        ]
        const baselineOnly = nextItems.filter((s) => s.source === "BASELINE")
        const tax = calculateTaxBreakdownFromItems(baselineOnly)
        return {
          ...c,
          scopeItems: nextItems,
          baseContractValue: tax.grandTotalWithTax,
          nonVatPortionAmount: tax.nonVatTotal,
          vatPortionAmount: tax.vatBaseTotal + tax.totalVatTax,
        }
      })
      persistContracts(next)
      toast.success("Đã thêm Mốc bàn giao (Milestone) mới!")
    },
    [contracts, persistContracts]
  )

  const updateScopeItem = React.useCallback(
    (contractId: string, scopeId: string, patch: Partial<ScopeItem>) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const nextItems = c.scopeItems.map((s) => {
          if (s.id !== scopeId) return s
          return { ...s, ...patch }
        })
        const baselineOnly = nextItems.filter((s) => s.source === "BASELINE")
        const tax = calculateTaxBreakdownFromItems(baselineOnly)
        const nextConsumedMd = nextItems.reduce(
          (sum, s) => sum + Number(s.actualMandays || 0),
          0
        )
        const allAccepted =
          nextItems.length > 0 &&
          nextItems.every((s) => s.isAccepted || s.status === "COMPLETED")
        const nextPhase: ContractProject["phase"] =
          c.phase === "CLOSED" || c.phase === "PRE_PROJECT"
            ? c.phase
            : allAccepted
            ? "POST_PROJECT"
            : "IN_PROJECT"
        return {
          ...c,
          phase: nextPhase,
          scopeItems: nextItems,
          actualConsumedMandays: nextConsumedMd,
          baseContractValue: tax.grandTotalWithTax,
          nonVatPortionAmount: tax.nonVatTotal,
          vatPortionAmount: tax.vatBaseTotal + tax.totalVatTax,
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const removeScopeItem = React.useCallback(
    (contractId: string, scopeId: string) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        if (c.scopeItems.length <= 1) {
          toast.error("Hợp đồng cần có ít nhất 1 Mốc bàn giao!")
          return c
        }
        const nextItems = c.scopeItems.filter((s) => s.id !== scopeId)
        const baselineOnly = nextItems.filter((s) => s.source === "BASELINE")
        const tax = calculateTaxBreakdownFromItems(baselineOnly)
        return {
          ...c,
          scopeItems: nextItems,
          baseContractValue: tax.grandTotalWithTax,
          nonVatPortionAmount: tax.nonVatTotal,
          vatPortionAmount: tax.vatBaseTotal + tax.totalVatTax,
        }
      })
      persistContracts(next)
      toast.info("Đã xóa Mốc bàn giao khỏi danh sách")
    },
    [contracts, persistContracts]
  )

  const updateInstallment = React.useCallback(
    (contractId: string, installmentId: string, patch: Partial<PaymentInstallment>) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          installments: c.installments.map((inst) =>
            inst.id === installmentId ? { ...inst, ...patch } : inst
          ),
        }
      })
      persistContracts(next)
      toast.success("Đã cập nhật trạng thái Đợt thanh toán / Hóa đơn VAT!")
    },
    [contracts, persistContracts]
  )

  const addInstallment = React.useCallback(
    (contractId: string, installment: Omit<PaymentInstallment, "id">) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          installments: [
            ...c.installments,
            {
              ...installment,
              id: `inst-${Date.now()}`,
            },
          ],
        }
      })
      persistContracts(next)
      toast.success("Đã thêm Đợt thanh toán mới vào lộ trình!")
    },
    [contracts, persistContracts]
  )

  const removeInstallment = React.useCallback(
    (contractId: string, installmentId: string) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        if (c.installments.length <= 1) {
          toast.error("Hợp đồng cần có ít nhất 1 đợt thanh toán")
          return c
        }
        return {
          ...c,
          installments: c.installments.filter((i) => i.id !== installmentId),
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const addContractDocument = React.useCallback(
    (contractId: string, doc: Omit<ProjectDocument, "id" | "uploadedAt">) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const existing = c.documents || []
        return {
          ...c,
          documents: [
            ...existing,
            {
              ...doc,
              id: `doc-${Date.now()}`,
              uploadedAt: new Date().toISOString().slice(0, 10),
            },
          ],
        }
      })
      persistContracts(next)
      toast.success(`Đã tải tài liệu "${doc.fileName}" lên hệ thống!`)
    },
    [contracts, persistContracts]
  )

  const removeContractDocument = React.useCallback(
    (contractId: string, docId: string) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          documents: (c.documents || []).filter((d) => d.id !== docId),
        }
      })
      persistContracts(next)
      toast.info("Đã xóa tài liệu khỏi hệ thống")
    },
    [contracts, persistContracts]
  )

  const updateHandover = React.useCallback(
    (contractId: string, patch: Partial<HandoverChecklist>) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          handover: {
            ...c.handover,
            ...patch,
          },
        }
      })
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const updateKpiSplitPercent = React.useCallback(
    (contractId: string, percent: number) => {
      const next = contracts.map((c) =>
        c.id === contractId ? { ...c, kpiBonusSplitPercent: percent } : c
      )
      persistContracts(next)
    },
    [contracts, persistContracts]
  )

  const closeProjectAndSettleKpi = React.useCallback(
    (contractId: string) => {
      const next = contracts.map((c) =>
        c.id === contractId
          ? {
              ...c,
              phase: "CLOSED" as const,
              closedAt: new Date().toISOString().slice(0, 10),
              closedBy: "Thảo (AM) & BOD",
            }
          : c
      )
      persistContracts(next)
      toast.success("Đã Đóng dự án thành công và chốt quyết toán 50/50 Quỹ dôi dư!")
    },
    [contracts, persistContracts]
  )

  const updateAmAdvanceAmount = React.useCallback(
    (contractId: string, amountVnd: number) => {
      const next = contracts.map((c) =>
        c.id === contractId
          ? {
              ...c,
              amAdvanceAmountVnd: Math.max(0, amountVnd),
            }
          : c
      )
      persistContracts(next)
      toast.success("Đã cập nhật hạn mức tạm ứng công tác phí cho AM!")
    },
    [contracts, persistContracts]
  )

  const addAmExpense = React.useCallback(
    (contractId: string, expense: Omit<AmExpenseItem, "id">) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        const existing = c.amExpenses || []
        return {
          ...c,
          amExpenses: [
            {
              ...expense,
              id: `exp-${Date.now()}`,
            },
            ...existing,
          ],
        }
      })
      persistContracts(next)
      toast.success("Đã ghi nhận khoản chi công tác của AM vào Sổ Tạm Ứng!")
    },
    [contracts, persistContracts]
  )

  const toggleAmExpenseStatus = React.useCallback(
    (contractId: string, expenseId: string) => {
      const next = contracts.map((c) => {
        if (c.id !== contractId) return c
        return {
          ...c,
          amExpenses: (c.amExpenses || []).map((exp) =>
            exp.id === expenseId
              ? {
                  ...exp,
                  status:
                    exp.status === "REIMBURSED"
                      ? ("PENDING_REIMBURSE" as const)
                      : ("REIMBURSED" as const),
                }
              : exp
          ),
        }
      })
      persistContracts(next)
      toast.success("Đã cập nhật trạng thái đối soát hoàn ứng Kế toán!")
    },
    [contracts, persistContracts]
  )

  const resetDemoData = React.useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_CONTRACTS)
    localStorage.removeItem(STORAGE_KEY_CUSTOMERS)
    setContracts(INITIAL_CONTRACTS)
    setCustomers(INITIAL_CUSTOMERS)
    setSelectedContractId(INITIAL_CONTRACTS[0].id)
    setIsPriceVisible(false)
    setActiveScreen("dashboard")
    toast.info("Đã khôi phục dữ liệu mẫu chuẩn theo biên bản họp 6 điểm!")
  }, [])

  const value = React.useMemo(
    () => ({
      roleView,
      setRoleView,
      isPriceVisible,
      setIsPriceVisible,
      togglePriceVisible,
      hidePrice,
      formatMoney,
      formatCompactMoney,
      activeScreen,
      setActiveScreen,
      activeDetailTab,
      setActiveDetailTab,
      selectedContractId,
      setSelectedContractId,
      selectedContract,
      customers,
      contracts,
      meetingOpen,
      setMeetingOpen,
      meetingNotes,
      updateMeetingNote,
      openContractDetail,
      createCustomer,
      createContract,
      updateContractPhase,
      approveKickoffByBod,
      toggleDriveVerified,
      updateKickoffChecklist,
      addContractTag,
      removeContractTag,
      updateTargetMandays,
      updateActionBlockerNote,
      logMilestoneMandays,
      finishMilestone,
      updateMilestone,
      addMilestone,
      removeMilestone,
      addPeriodicCheckIn,
      addChangeRequest,
      resolveChangeRequest,
      toggleScopeItemAccepted,
      acceptAllScopeItems,
      addScopeItem,
      updateScopeItem,
      removeScopeItem,
      updateInstallment,
      addInstallment,
      removeInstallment,
      addContractDocument,
      removeContractDocument,
      updateHandover,
      updateKpiSplitPercent,
      closeProjectAndSettleKpi,
      updateAmAdvanceAmount,
      addAmExpense,
      toggleAmExpenseStatus,
      resetDemoData,
    }),
    [
      roleView,
      isPriceVisible,
      togglePriceVisible,
      hidePrice,
      formatMoney,
      formatCompactMoney,
      activeScreen,
      activeDetailTab,
      selectedContractId,
      selectedContract,
      customers,
      contracts,
      meetingOpen,
      meetingNotes,
      updateMeetingNote,
      openContractDetail,
      createCustomer,
      createContract,
      updateContractPhase,
      approveKickoffByBod,
      toggleDriveVerified,
      updateKickoffChecklist,
      addContractTag,
      removeContractTag,
      updateTargetMandays,
      updateActionBlockerNote,
      logMilestoneMandays,
      finishMilestone,
      updateMilestone,
      addMilestone,
      removeMilestone,
      addPeriodicCheckIn,
      addChangeRequest,
      resolveChangeRequest,
      toggleScopeItemAccepted,
      acceptAllScopeItems,
      addScopeItem,
      updateScopeItem,
      removeScopeItem,
      updateInstallment,
      addInstallment,
      removeInstallment,
      addContractDocument,
      removeContractDocument,
      updateHandover,
      updateKpiSplitPercent,
      closeProjectAndSettleKpi,
      updateAmAdvanceAmount,
      addAmExpense,
      toggleAmExpenseStatus,
      resetDemoData,
    ]
  )

  return <AmPrototypeContext.Provider value={value}>{children}</AmPrototypeContext.Provider>
}

export function useAmPrototype() {
  const ctx = React.useContext(AmPrototypeContext)
  if (!ctx) {
    throw new Error("useAmPrototype must be used within AmPrototypeProvider")
  }
  return ctx
}
