"use client"

import * as React from "react"
import { navigateWorkspace } from "@/lib/fast-nav"
import { useAuth } from "@/components/providers/auth-provider"
import type { ProjectDetailTab, ScreenTab } from "@/lib/mock/am-types"

interface WorkspaceUiContextValue {
  hidePrice: boolean
  togglePriceVisible: () => void
  formatMoney: (amount: number) => string
  formatCompactMoney: (amount: number) => string
  openContractDetail: (contractId: string) => void
  setActiveScreen: (screen: ScreenTab) => void
  setActiveDetailTab: (tab: ProjectDetailTab) => void
}

const WorkspaceUiContext = React.createContext<WorkspaceUiContextValue | null>(null)

const SCREEN_TO_PATH: Record<ScreenTab, string> = {
  dashboard: "/",
  "am-tasks": "/tasks",
  contracts: "/contracts",
  "create-contract": "/contracts/new",
  "project-detail": "/contracts",
  "billing-vat": "/billing-vat",
  "am-expenses": "/am-expenses",
  "change-requests": "/contracts",
  customers: "/customers",
}

export function WorkspaceUiProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const isPmRole = isAuthenticated && user?.role === "PM"
  const [manualHidePrice, setManualHidePrice] = React.useState(false)

  const hidePrice = isPmRole || manualHidePrice

  const togglePriceVisible = React.useCallback(() => {
    if (isPmRole) return
    setManualHidePrice((prev) => !prev)
  }, [isPmRole])

  const formatMoney = React.useCallback(
    (amount: number) => {
      if (hidePrice) return "•••••••• đ"
      return `${Math.round(Number(amount || 0)).toLocaleString("vi-VN")} đ`
    },
    [hidePrice]
  )

  const formatCompactMoney = React.useCallback(
    (amount: number) => {
      if (hidePrice) return "••• tr"
      const num = Number(amount || 0)
      const abs = Math.abs(num)
      if (abs >= 1_000_000_000) {
        return `${(num / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "")} tỷ`
      }
      if (abs >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, "")} tr`
      }
      return `${Math.round(num).toLocaleString("vi-VN")} đ`
    },
    [hidePrice]
  )

  const openContractDetail = React.useCallback((contractId: string) => {
    if (!contractId) return
    navigateWorkspace(`/contracts/${encodeURIComponent(contractId)}`)
  }, [])

  const setActiveScreen = React.useCallback((screen: ScreenTab) => {
    navigateWorkspace(SCREEN_TO_PATH[screen] || "/")
  }, [])

  const setActiveDetailTab = React.useCallback((_tab: ProjectDetailTab) => {
    // No-op: chi tiết dự án dùng trực tiếp giao diện workspace theo URL
  }, [])

  const value = React.useMemo<WorkspaceUiContextValue>(
    () => ({
      hidePrice,
      togglePriceVisible,
      formatMoney,
      formatCompactMoney,
      openContractDetail,
      setActiveScreen,
      setActiveDetailTab,
    }),
    [
      hidePrice,
      togglePriceVisible,
      formatMoney,
      formatCompactMoney,
      openContractDetail,
      setActiveScreen,
      setActiveDetailTab,
    ]
  )

  return (
    <WorkspaceUiContext.Provider value={value}>
      {children}
    </WorkspaceUiContext.Provider>
  )
}

export function useWorkspaceUi() {
  const ctx = React.useContext(WorkspaceUiContext)
  if (!ctx) {
    throw new Error("useWorkspaceUi must be used within WorkspaceUiProvider")
  }
  return ctx
}
