"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { AppHeader } from "@/components/layout/app-header"
import { useFastPathname } from "@/lib/fast-nav"
import { ProductiveHomeDashboard } from "@/components/features/am/ProductiveHomeDashboard"
import { useAuth } from "@/components/providers/auth-provider"

function StageSkeleton() {
  return (
    <div className="flex-1 bg-slate-50 px-6 lg:px-8 py-6 w-full space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-slate-200/80" />
          <div className="h-4 w-80 rounded bg-slate-200/60" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-200/80" />
      </div>
      <div className="h-80 w-full rounded-xl border border-slate-200 bg-white" />
    </div>
  )
}

const PortfolioDashboardView = dynamic(
  () =>
    import("@/components/features/am/PortfolioDashboardView").then(
      (m) => m.PortfolioDashboardView
    ),
  { loading: StageSkeleton }
)

const ContractWorkspaceView = dynamic(
  () =>
    import("@/components/features/am/ContractWorkspaceView").then(
      (m) => m.ContractWorkspaceView
    ),
  { loading: StageSkeleton }
)

const PreProjectSetupView = dynamic(
  () =>
    import("@/components/features/am/PreProjectSetupView").then(
      (m) => m.PreProjectSetupView
    ),
  { loading: StageSkeleton }
)

const BillingVatListView = dynamic(
  () =>
    import("@/components/features/am/BillingVatListView").then(
      (m) => m.BillingVatListView
    ),
  { loading: StageSkeleton }
)

const AmExpensesView = dynamic(
  () => import("@/components/features/am/AmExpensesView").then((m) => m.AmExpensesView),
  { loading: StageSkeleton }
)

const CustomerListView = dynamic(
  () =>
    import("@/components/features/am/CustomerListView").then(
      (m) => m.CustomerListView
    ),
  { loading: StageSkeleton }
)

const AmTaskDashboardView = dynamic(
  () =>
    import("@/components/features/am/AmTaskDashboardView").then(
      (m) => m.AmTaskDashboardView
    ),
  { loading: StageSkeleton }
)

const UserManagementView = dynamic(
  () =>
    import("@/components/features/users/UserManagementView").then(
      (m) => m.UserManagementView
    ),
  { loading: StageSkeleton }
)

const AuditLogViewer = dynamic(
  () =>
    import("@/components/features/audit/AuditLogViewer").then(
      (m) => m.AuditLogViewer
    ),
  { loading: StageSkeleton }
)

function parseWorkspaceRoute(pathname: string) {
  if (pathname === "/") return { kind: "dashboard" as const }
  if (pathname === "/tasks") return { kind: "tasks" as const }
  if (pathname === "/contracts") return { kind: "contracts" as const }
  if (pathname === "/contracts/new") return { kind: "contract-new" as const }
  if (pathname.startsWith("/contracts/")) {
    const id = decodeURIComponent(pathname.slice("/contracts/".length).split("/")[0] || "")
    if (id) return { kind: "contract-detail" as const, id }
  }
  if (pathname === "/billing-vat") return { kind: "billing-vat" as const }
  if (pathname === "/am-expenses") return { kind: "am-expenses" as const }
  if (pathname === "/customers") return { kind: "customers" as const }
  if (pathname.startsWith("/customers/")) {
    const id = decodeURIComponent(pathname.slice("/customers/".length).split("/")[0] || "")
    if (id) return { kind: "customer-detail" as const, id }
  }
  if (pathname === "/users") return { kind: "users" as const }
  if (pathname === "/audit-logs") return { kind: "audit-logs" as const }
  return null
}

export function ErpAppShell({ children }: { children: React.ReactNode }) {
  const pathname = useFastPathname()
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()

  // Preload các module chính trong thời gian rảnh sau khi hiển thị trang đầu tiên
  React.useEffect(() => {
    if (!isAuthenticated) return
    const timer = window.setTimeout(() => {
      void import("@/components/features/am/PortfolioDashboardView")
      void import("@/components/features/am/BillingVatListView")
      void import("@/components/features/am/AmExpensesView")
      void import("@/components/features/am/CustomerListView")
      void import("@/components/features/am/ContractWorkspaceView")
      void import("@/components/features/am/PreProjectSetupView")
    }, 250)
    return () => window.clearTimeout(timer)
  }, [isAuthenticated])

  // Nếu phiên đăng nhập hết hạn/không hợp lệ ở phía client -> đẩy về /login
  React.useEffect(() => {
    if (pathname === "/login" || pathname === "/403") return
    if (!isAuthLoading && !isAuthenticated && typeof window !== "undefined") {
      window.location.href = "/login?session_expired=true"
    }
  }, [pathname, isAuthLoading, isAuthenticated])

  if (pathname === "/login" || pathname === "/403") {
    return <>{children}</>
  }

  const matched = parseWorkspaceRoute(pathname)
  const showLoadingGate = matched !== null && (isAuthLoading || !isAuthenticated)

  return (
    <div className="relative flex min-h-svh md:h-screen flex-col bg-background md:overflow-hidden">
      <AppHeader />
      <main className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
        {showLoadingGate ? (
          <StageSkeleton />
        ) : matched ? (
          matched.kind === "dashboard" ? (
            <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
              <ProductiveHomeDashboard />
            </div>
          ) : matched.kind === "contract-detail" ? (
            <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
              <ContractWorkspaceView contractIdParam={matched.id} />
            </div>
          ) : matched.kind === "users" ? (
            <UserManagementView />
          ) : (
            <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
              <div className="flex-1 px-6 lg:px-8 py-6 w-full">
                {matched.kind === "contracts" && <PortfolioDashboardView />}
                {matched.kind === "contract-new" && <PreProjectSetupView mode="create" />}
                {matched.kind === "billing-vat" && <BillingVatListView />}
                {matched.kind === "am-expenses" && <AmExpensesView />}
                {matched.kind === "customers" && <CustomerListView />}
                {matched.kind === "customer-detail" && (
                  <CustomerListView customerIdParam={matched.id} />
                )}
                {matched.kind === "tasks" && <AmTaskDashboardView />}
                {matched.kind === "audit-logs" && <AuditLogViewer />}
              </div>
            </div>
          )
        ) : (
          children
        )}
      </main>
    </div>
  )
}

export function ErpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
