"use client"

import * as React from "react"
import { ErpLayout } from "@/components/layout/erp-layout"
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import { ProductiveHomeDashboard } from "@/components/features/am/ProductiveHomeDashboard"
import { PortfolioDashboardView } from "@/components/features/am/PortfolioDashboardView"
import { AmTaskDashboardView } from "@/components/features/am/AmTaskDashboardView"
import { ContractWorkspaceView } from "@/components/features/am/ContractWorkspaceView"
import { PreProjectSetupView } from "@/components/features/am/PreProjectSetupView"
import { BillingVatListView } from "@/components/features/am/BillingVatListView"
import { AmExpensesView } from "@/components/features/am/AmExpensesView"
import { CustomerListView } from "@/components/features/am/CustomerListView"
import { MeetingGuideDrawer } from "@/components/features/am/MeetingGuideDrawer"

export default function AmPrototypeMainPage() {
  const { activeScreen } = useAmPrototype()

  return (
    <ErpLayout>
      <div className="flex-1 bg-slate-50 flex flex-col h-full overflow-y-auto">
        {/* 1. HOME: Giao diện Widget Dashboard chuẩn Productive.io */}
        {activeScreen === "dashboard" && <ProductiveHomeDashboard />}

        {/* 2. PROJECT DETAIL: Mặt phẳng quản lý Mốc bàn giao & Đợt thanh toán chuẩn Productive.io */}
        {activeScreen === "project-detail" && <ContractWorkspaceView />}

        {/* Các màn hình danh sách khác */}
        {activeScreen !== "dashboard" && activeScreen !== "project-detail" && (
          <div className="flex-1 px-6 lg:px-8 py-6 w-full">
            {activeScreen === "contracts" && <PortfolioDashboardView />}
            {activeScreen === "am-tasks" && <AmTaskDashboardView />}
            {activeScreen === "create-contract" && (
              <PreProjectSetupView mode="create" />
            )}
            {activeScreen === "billing-vat" && <BillingVatListView />}
            {activeScreen === "am-expenses" && <AmExpensesView />}
            {activeScreen === "customers" && <CustomerListView />}
          </div>
        )}
      </div>

      <MeetingGuideDrawer />
    </ErpLayout>
  )
}
