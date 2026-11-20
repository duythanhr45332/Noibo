'use client'

/**
 * TanStack Query Provider — bọc toàn bộ app để các hooks
 * useQuery / useMutation / useInfiniteQuery hoạt động mượt mà khi chuyển trang.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
