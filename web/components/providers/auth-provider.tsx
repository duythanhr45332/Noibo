"use client"

import * as React from "react"
import { axiosInstance } from "@/lib/api/axios-instance"
import Cookies from "js-cookie"

export type UserProfile = {
  user_id: string;
  username: string;
  full_name: string;
  department?: string | null;
  role: string;
  role_id?: number;
  role_code?: string;
  is_system: boolean;
  is_system_role?: boolean;
  permissions: Array<string | { module: string; action: string }>;
}

type AuthContextType = {
  user: UserProfile | null;
  isLoading: boolean;
  hasPermission: (module: string, action: string) => boolean;
  refetchUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

const DEFAULT_DEMO_USER: UserProfile = {
  user_id: "demo-am-01",
  username: "thao.am",
  full_name: "Thảo (Account Manager)",
  department: "Khối Quản trị Dự án & Khách hàng",
  role: "ACCOUNT_MANAGER",
  is_system: true,
  is_system_role: true,
  permissions: ["SYSTEM_ADMIN"],
}

export function AuthProvider({ children, initialUser = null }: { children: React.ReactNode, initialUser?: UserProfile | null }) {
  const [user, setUser] = React.useState<UserProfile | null>(initialUser || DEFAULT_DEMO_USER)
  const [isLoading, setIsLoading] = React.useState(false)

  const fetchUser = React.useCallback(async () => {
    const hasToken = Boolean(Cookies.get('token') || Cookies.get('refreshToken'))
    if (!hasToken) {
      setUser(DEFAULT_DEMO_USER)
      setIsLoading(false)
      return
    }
    try {
      Cookies.remove('user_profile')
      const res = await axiosInstance.get('/auth/me', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      })
      if (res.data.success) {
        setUser(res.data.data)
      } else {
        setUser(DEFAULT_DEMO_USER)
      }
    } catch {
      setUser(DEFAULT_DEMO_USER)
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchUser()

    const handleFocus = () => {
      fetchUser()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchUser])

  const hasPermission = React.useCallback((module: string, action: string) => {
    if (!user) return false;
    if (user.is_system || user.is_system_role) return true;
    if (user.permissions?.includes('SYSTEM_ADMIN')) return true;
    return Boolean(
      user.permissions?.some((perm) =>
        typeof perm === 'string'
          ? perm === `${module}.${action}`
          : perm.module === module && perm.action === action
      )
    );
  }, [user])

  const value = React.useMemo(
    () => ({ user, isLoading, hasPermission, refetchUser: fetchUser }),
    [user, isLoading, hasPermission, fetchUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

export function usePermissions() {
  const { hasPermission } = useAuth()
  return { hasPermission }
}

export function RequirePermission({
  module,
  action,
  children,
  fallback = null,
}: {
  module: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { hasPermission, isLoading } = useAuth()

  if (isLoading) return null;

  if (hasPermission(module, action)) {
    return <>{children}</>
  }

  return <>{fallback}</>
}
