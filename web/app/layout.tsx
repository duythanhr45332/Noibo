import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"
import { QueryProvider } from "@/lib/query-provider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/providers/auth-provider"
import { WorkspaceUiProvider } from "@/components/providers/workspace-ui-provider"
import { ErpAppShell } from "@/components/layout/erp-layout"

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <QueryProvider>
          <AuthProvider>
            <WorkspaceUiProvider>
              <ThemeProvider>
                <ErpAppShell>{children}</ErpAppShell>
              </ThemeProvider>
              <Toaster position="top-right" />
            </WorkspaceUiProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
