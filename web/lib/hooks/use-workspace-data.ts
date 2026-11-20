"use client"

import * as React from "react"
import { useQueries } from "@tanstack/react-query"
import { useAuth } from "@/components/providers/auth-provider"
import {
  getGetApiV1ContractsIdQueryOptions,
  useGetApiV1Contracts,
} from "@/lib/api/generated/contracts/contracts"
import { useGetApiV1CustomersOptions } from "@/lib/api/generated/customers/customers"
import {
  mapApiContractDetailToProject,
  mapApiContractSummaryToProject,
} from "@/lib/api/contract-mapper"
import type { ContractProject } from "@/lib/mock/am-types"

export interface WorkspaceCustomerOption {
  id: string
  name: string
  companyName: string
  taxCode?: string
}

/**
 * Hook trung tâm đọc danh sách Dự án/Hợp đồng trực tiếp từ PostgreSQL API.
 */
export function useWorkspaceContracts(options?: {
  includeDetails?: boolean
  enabled?: boolean
}) {
  const includeDetails = options?.includeDetails ?? false
  const extraEnabled = options?.enabled ?? true

  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const canQueryRealApi = isAuthenticated && !isAuthLoading
  const shouldQueryApi = canQueryRealApi && extraEnabled

  const apiContractsListQuery = useGetApiV1Contracts(
    { page: 1, limit: 100 },
    { query: { enabled: shouldQueryApi } }
  )

  const apiContractIds = React.useMemo(
    () =>
      (apiContractsListQuery.data?.data?.items || [])
        .map((c) => c.contract_id)
        .filter((id): id is string => Boolean(id)),
    [apiContractsListQuery.data]
  )

  const apiContractDetailQueries = useQueries({
    queries: includeDetails
      ? apiContractIds.map((id) =>
          getGetApiV1ContractsIdQueryOptions(id, {
            query: { enabled: shouldQueryApi && Boolean(id) },
          })
        )
      : [],
  })

  const contracts = React.useMemo<ContractProject[]>(() => {
    if (!canQueryRealApi) return []
    if (includeDetails) {
      return apiContractDetailQueries
        .map((q) => q.data?.data)
        .filter((dto): dto is NonNullable<typeof dto> => Boolean(dto))
        .map(mapApiContractDetailToProject)
    }
    return (apiContractsListQuery.data?.data?.items || []).map(
      mapApiContractSummaryToProject
    )
  }, [
    canQueryRealApi,
    includeDetails,
    apiContractDetailQueries,
    apiContractsListQuery.data,
  ])

  const isDetailsLoading =
    includeDetails &&
    apiContractIds.length > 0 &&
    apiContractDetailQueries.some((q) => q.isLoading)

  const isDetailsFetching =
    includeDetails && apiContractDetailQueries.some((q) => q.isFetching)

  const isLoading = shouldQueryApi && (apiContractsListQuery.isLoading || isDetailsLoading)
  const isFetching = shouldQueryApi && (apiContractsListQuery.isFetching || isDetailsFetching)
  const isError =
    shouldQueryApi &&
    (apiContractsListQuery.isError ||
      (includeDetails && apiContractDetailQueries.some((q) => q.isError)))

  const refetch = React.useCallback(() => {
    if (!canQueryRealApi) return
    apiContractsListQuery.refetch()
    if (includeDetails) {
      apiContractDetailQueries.forEach((q) => {
        void q.refetch()
      })
    }
  }, [canQueryRealApi, apiContractsListQuery, includeDetails, apiContractDetailQueries])

  return {
    contracts,
    isLoading,
    isFetching,
    isError,
    canQueryRealApi,
    refetch,
  }
}

/**
 * Hook trung tâm cung cấp danh sách lựa chọn Khách hàng trực tiếp từ PostgreSQL API.
 */
export function useWorkspaceCustomerOptions(options?: { enabled?: boolean }) {
  const extraEnabled = options?.enabled ?? true
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const canQueryRealApi = isAuthenticated && !isAuthLoading

  const apiOptionsQuery = useGetApiV1CustomersOptions({
    query: { enabled: canQueryRealApi && extraEnabled },
  })

  const customerOptions = React.useMemo<WorkspaceCustomerOption[]>(() => {
    if (!canQueryRealApi) return []
    const items = apiOptionsQuery.data?.data || []
    return items
      .filter((item) => Boolean(item.customer_id && item.name))
      .map((item) => ({
        id: item.customer_id as string,
        name: item.name as string,
        companyName: item.name as string,
        taxCode: item.tax_code || undefined,
      }))
  }, [canQueryRealApi, apiOptionsQuery.data])

  return {
    customerOptions,
    isLoading: canQueryRealApi ? apiOptionsQuery.isLoading : false,
    refetch: apiOptionsQuery.refetch,
  }
}

/**
 * Hook chuẩn hóa vai trò & quyền thao tác theo JWT user thật đang đăng nhập.
 */
export function useWorkspaceRole() {
  const { user, isAuthenticated } = useAuth()

  const effectiveRole = isAuthenticated ? user?.role || "PM" : "GUEST"
  const isPmRole = effectiveRole === "PM"
  const canConfirmAccountantOps =
    isAuthenticated &&
    ["ADMIN", "BOD", "ACCOUNTANT", "AM"].includes(user?.role || "")

  const canManageCustomers =
    isAuthenticated && ["ADMIN", "BOD", "AM"].includes(user?.role || "")

  const canViewAuditLogs =
    isAuthenticated &&
    ["ADMIN", "BOD", "ACCOUNTANT", "AM"].includes(user?.role || "")

  const canManageUsers =
    isAuthenticated && ["ADMIN", "BOD"].includes(user?.role || "")

  return {
    effectiveRole,
    isPmRole,
    canConfirmAccountantOps,
    canManageCustomers,
    canViewAuditLogs,
    canManageUsers,
  }
}
