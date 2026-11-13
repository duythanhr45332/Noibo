"use client"

import * as React from "react"
import { AppHeader } from "@/components/layout/app-header"

export function ErpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh md:h-screen flex-col bg-background md:overflow-hidden">
      <AppHeader />
      <main className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
        {children}
      </main>
    </div>
  )
}
