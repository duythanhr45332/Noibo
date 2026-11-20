"use client"

import * as React from "react"
import { axiosInstance } from "@/lib/api/axios-instance"

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
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (module: string, action: string) => boolean;
  refetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

const FOCUS_RECHECK_INTERVAL_MS = 5 * 60 * 1000

export function AuthProvider({ children, initialUser = null }: { children: React.ReactNode, initialUser?: UserProfile | null }) {
  const [user, setUser] = React.useState<UserProfile | null>(initialUser)
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(Boolean(initialUser))
  const [isLoading, setIsLoading] = React.useState<boolean>(!initialUser)
  const lastFetchedAtRef = React.useRef<number>(0)
  const hasInitializedRef = React.useRef<boolean>(Boolean(initialUser))

  const fetchUser = React.useCallback(async () => {
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      setIsLoading(false)
      return
    }
    const isInitialLoad = !hasInitializedRef.current
    try {
      if (isInitialLoad) setIsLoading(true)
      const res = await axiosInstance.get('/auth/session')
      lastFetchedAtRef.current = Date.now()
      hasInitializedRef.current = true
      const sessionData = res.data?.data as
        | { authenticated?: boolean; user?: UserProfile | null }
        | undefined
      if (res.data?.success && sessionData?.authenticated && sessionData?.user) {
        const nextUser = sessionData.user
        setUser((prev) =>
          prev &&
          prev.user_id === nextUser.user_id &&
          prev.role === nextUser.role &&
          prev.full_name === nextUser.full_name
            ? prev
            : nextUser
        )
        setIsAuthenticated(true)
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
    } catch {
      lastFetchedAtRef.current = Date.now()
      hasInitializedRef.current = true
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      if (isInitialLoad) setIsLoading(false)
    }
  }, [])

  const logout = React.useCallback(async () => {
    try {
      await axiosInstance.post('/auth/logout')
    } catch {
      // Ignore network/401 errors during logout and still reset client state
    } finally {
      setUser(null)
      setIsAuthenticated(false)
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }, [])

  React.useEffect(() => {
    fetchUser()

    const handleFocus = () => {
      if (Date.now() - lastFetchedAtRef.current > FOCUS_RECHECK_INTERVAL_MS) {
        fetchUser()
      }
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
    () => ({ user, isAuthenticated, isLoading, hasPermission, refetchUser: fetchUser, logout }),
    [user, isAuthenticated, isLoading, hasPermission, fetchUser, logout]
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
