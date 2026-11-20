"use client"

import * as React from "react"
import { navigateWorkspace } from "@/lib/fast-nav"
import { useQueryClient } from "@tanstack/react-query"
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBuilding,
  IconEdit,
  IconEye,
  IconNotes,
  IconPlus,
  IconSearch,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { StandardPagination } from "@/components/ui/standard-pagination"
import { useAuth } from "@/components/providers/auth-provider"
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider"
import { useWorkspaceRole } from "@/lib/hooks/use-workspace-data"
import { PersonAvatar } from "@/components/features/am/ProductiveHomeDashboard"
import { calculateContractMetrics, Customer } from "@/lib/mock/am-types"
import {
  useDeleteApiV1CustomersId,
  useGetApiV1Customers,
  useGetApiV1CustomersId,
  usePostApiV1Customers,
  usePutApiV1CustomersId,
} from "@/lib/api/generated/customers/customers"

interface CustomerFormState {
  code: string
  name: string
  taxCode: string
  industry: string
  address: string
  note: string
  techName: string
  techTitle: string
  techPhone: string
  techEmail: string
  accName: string
  accTitle: string
  accPhone: string
  accEmail: string
}

interface DeleteCustomerTarget {
  id: string
  code: string
  name: string
  taxCode: string
  contractCount: number
}

const EMPTY_FORM: CustomerFormState = {
  code: "",
  name: "",
  taxCode: "",
  industry: "Doanh nghiệp",
  address: "",
  note: "",
  techName: "",
  techTitle: "IT Manager",
  techPhone: "",
  techEmail: "",
  accName: "Phòng Kế toán",
  accTitle: "Kế toán thanh toán",
  accPhone: "",
  accEmail: "",
}

function extractCustomerApiError(err: unknown, fallback: string): string {
  const axiosErr = err as {
    response?: {
      data?: {
        errors?: Array<{ field?: string; message?: string }>
        error?: { message?: string }
        message?: string
      }
    }
  }
  return (
    axiosErr?.response?.data?.errors?.[0]?.message ||
    axiosErr?.response?.data?.error?.message ||
    axiosErr?.response?.data?.message ||
    fallback
  )
}

function formatPhaseVi(phase?: string | null): string {
  switch (phase) {
    case "PRE_PROJECT":
      return "Chuẩn bị"
    case "IN_PROJECT":
      return "Đang chạy"
    case "POST_PROJECT":
      return "Bàn giao"
    case "CLOSED":
      return "Hoàn thành"
    default:
      return phase || "—"
  }
}

export function CustomerListView({
  customerIdParam,
}: {
  customerIdParam?: string
} = {}) {
  const queryClient = useQueryClient()
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const canQueryRealApi = isAuthenticated && !isAuthLoading
  const { isPmRole, canManageCustomers: canManageCustomer } = useWorkspaceRole()
  const { formatMoney, openContractDetail, setActiveScreen } = useWorkspaceUi()

  const [page, setPage] = React.useState(1)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(
    customerIdParam || null
  )

  React.useEffect(() => {
    setSelectedCustomerId(customerIdParam || null)
  }, [customerIdParam])

  React.useEffect(() => {
    const onPopState = () => {
      const p = window.location.pathname
      if (p === "/customers") {
        setSelectedCustomerId(null)
      } else if (p.startsWith("/customers/")) {
        const seg = decodeURIComponent(p.slice("/customers/".length).split("/")[0] || "")
        setSelectedCustomerId(seg || null)
      }
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  const [customerModalOpen, setCustomerModalOpen] = React.useState(false)
  const [editingCustomerId, setEditingCustomerId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<CustomerFormState>(EMPTY_FORM)
  const [deletingCustomer, setDeletingCustomer] = React.useState<DeleteCustomerTarget | null>(
    null
  )

  const limit = 10

  // Real Backend Queries & Mutations (enabled ONLY in Luồng Dữ liệu Thật)
  const customersQuery = useGetApiV1Customers(
    { page, limit, search: searchQuery.trim() || undefined },
    { query: { enabled: canQueryRealApi } }
  )

  const customerDetailQuery = useGetApiV1CustomersId(selectedCustomerId || "", {
    query: {
      enabled: canQueryRealApi && Boolean(selectedCustomerId),
      retry: false,
    },
  })

  const createMutation = usePostApiV1Customers()
  const updateMutation = usePutApiV1CustomersId()
  const deleteMutation = useDeleteApiV1CustomersId()

  const invalidateCustomers = React.useCallback(
    (targetId?: string | null) => {
      queryClient.invalidateQueries({ queryKey: ["/api/v1/customers"] })
      queryClient.invalidateQueries({ queryKey: ["/api/v1/customers/options"] })
      const idToRefresh = targetId ?? selectedCustomerId
      if (idToRefresh) {
        queryClient.invalidateQueries({ queryKey: [`/api/v1/customers/${idToRefresh}`] })
      }
    },
    [queryClient, selectedCustomerId]
  )

  const openCustomerDetail = React.useCallback((customerId: string) => {
    setSelectedCustomerId(customerId)
    navigateWorkspace(`/customers/${encodeURIComponent(customerId)}`)
  }, [])

  const closeCustomerDetail = React.useCallback(() => {
    setSelectedCustomerId(null)
    navigateWorkspace("/customers")
  }, [])

  const openCreateModal = () => {
    setEditingCustomerId(null)
    setForm(EMPTY_FORM)
    setCustomerModalOpen(true)
  }

  const openEditModal = (cust: {
    id: string
    code: string
    name: string
    taxCode: string
    industry: string
    address: string
    note: string
    techName: string
    techTitle: string
    techPhone: string
    techEmail: string
    accName: string
    accTitle: string
    accPhone: string
    accEmail: string
  }) => {
    setEditingCustomerId(cust.id)
    setForm({
      code: cust.code,
      name: cust.name,
      taxCode: cust.taxCode,
      industry: cust.industry,
      address: cust.address,
      note: cust.note,
      techName: cust.techName,
      techTitle: cust.techTitle,
      techPhone: cust.techPhone,
      techEmail: cust.techEmail,
      accName: cust.accName,
      accTitle: cust.accTitle,
      accPhone: cust.accPhone,
      accEmail: cust.accEmail,
    })
    setCustomerModalOpen(true)
  }

  const handleSaveCustomer = async () => {
    const trimmedName = form.name.trim()
    const trimmedTax = form.taxCode.trim()
    const trimmedCode = form.code.trim().toUpperCase()

    if (trimmedName.length < 2) {
      toast.error("Tên doanh nghiệp phải có tối thiểu 2 ký tự")
      return
    }
    if (!trimmedTax) {
      toast.error("Vui lòng nhập Mã số thuế doanh nghiệp")
      return
    }

    const payload = {
      ...(trimmedCode ? { code: trimmedCode } : {}),
      name: trimmedName,
      tax_code: trimmedTax,
      industry: form.industry.trim() || null,
      address: form.address.trim() || null,
      note: form.note.trim() || null,
      tech_contact: {
        name: form.techName.trim(),
        title: form.techTitle.trim(),
        phone: form.techPhone.trim(),
        email: form.techEmail.trim(),
      },
      accounting_contact: {
        name: form.accName.trim(),
        title: form.accTitle.trim(),
        phone: form.accPhone.trim(),
        email: form.accEmail.trim(),
      },
    }

    try {
      if (editingCustomerId) {
        await updateMutation.mutateAsync({ id: editingCustomerId, data: payload })
        toast.success(`Đã cập nhật hồ sơ khách hàng "${trimmedName}"`)
        invalidateCustomers(editingCustomerId)
      } else {
        const res = await createMutation.mutateAsync({ data: payload })
        toast.success(`Đã thêm khách hàng "${trimmedName}" vào hệ thống`)
        invalidateCustomers(res?.data?.customer_id || null)
      }
      setCustomerModalOpen(false)
      setEditingCustomerId(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(extractCustomerApiError(err, "Không thể lưu thông tin khách hàng"))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingCustomer) return
    const target = deletingCustomer

    try {
      await deleteMutation.mutateAsync({ id: target.id })
      toast.success(`Đã xóa khách hàng "${target.name}"`)
      setDeletingCustomer(null)
      if (selectedCustomerId === target.id) {
        closeCustomerDetail()
      }
      queryClient.invalidateQueries({ queryKey: ["/api/v1/customers"] })
      queryClient.invalidateQueries({ queryKey: ["/api/v1/customers/options"] })
      queryClient.removeQueries({ queryKey: [`/api/v1/customers/${target.id}`] })
    } catch (err) {
      toast.error(extractCustomerApiError(err, "Không thể xóa khách hàng"))
    }
  }

  const apiCustomers = customersQuery.data?.data?.items || []
  const apiPagination = customersQuery.data?.data?.pagination || {
    page,
    limit,
    total: 0,
    totalPages: 1,
  }

  const renderDetailContent = () => {
    if (!selectedCustomerId) return null

    if (customerDetailQuery.isLoading) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Đang tải hồ sơ khách hàng...
        </div>
      )
    }

    const apiDetail = customerDetailQuery.data?.data

    if (apiDetail) {
      const detailContracts = apiDetail.contracts || []
      const contractCount = Number(apiDetail.contract_count ?? detailContracts.length)
      const totalContractValue =
        apiDetail.total_contract_value !== undefined && apiDetail.total_contract_value !== null
          ? Number(apiDetail.total_contract_value)
          : detailContracts.reduce(
              (acc, ct) =>
                acc +
                Number(ct.base_contract_value || 0) +
                Number(ct.approved_upsell_value || 0),
              0
            )

      return (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 text-sm gap-1.5"
                onClick={closeCustomerDetail}
              >
                <IconArrowLeft className="size-4" />
                Danh bạ Khách hàng
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    {apiDetail.name}
                  </h1>
                  {apiDetail.industry && (
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {apiDetail.industry}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  Mã KH: <span className="font-mono text-slate-700">{apiDetail.code}</span> • MST:{" "}
                  <span className="font-mono text-slate-700">{apiDetail.tax_code || "—"}</span> •
                  Địa chỉ: {apiDetail.address || "—"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManageCustomer && (
                <>
                  <Button
                    variant="outline"
                    className="h-9 px-3 text-sm gap-1.5"
                    onClick={() =>
                      openEditModal({
                        id: apiDetail.customer_id || selectedCustomerId,
                        code: apiDetail.code || "",
                        name: apiDetail.name || "",
                        taxCode: apiDetail.tax_code || "",
                        industry: apiDetail.industry || "",
                        address: apiDetail.address || "",
                        note: apiDetail.note || "",
                        techName: apiDetail.tech_contact?.name || "",
                        techTitle: apiDetail.tech_contact?.title || "",
                        techPhone: apiDetail.tech_contact?.phone || "",
                        techEmail: apiDetail.tech_contact?.email || "",
                        accName: apiDetail.accounting_contact?.name || "",
                        accTitle: apiDetail.accounting_contact?.title || "",
                        accPhone: apiDetail.accounting_contact?.phone || "",
                        accEmail: apiDetail.accounting_contact?.email || "",
                      })
                    }
                  >
                    <IconEdit className="size-4" />
                    Sửa hồ sơ
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 px-3 text-sm gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() =>
                      setDeletingCustomer({
                        id: apiDetail.customer_id || selectedCustomerId,
                        code: apiDetail.code || "—",
                        name: apiDetail.name || "Khách hàng",
                        taxCode: apiDetail.tax_code || "—",
                        contractCount,
                      })
                    }
                  >
                    <IconTrash className="size-4" />
                    Xóa
                  </Button>
                  <Button
                    onClick={() => setActiveScreen("create-contract")}
                    className="h-9 px-4 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white gap-1.5 rounded-lg"
                  >
                    <IconPlus className="size-4" />
                    Tạo Hợp đồng mới
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Tóm tắt doanh nghiệp & Ghi chú */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <IconBuilding className="size-3.5 text-slate-400" />
                Quy mô hợp tác
              </div>
              <div className="text-base font-semibold text-slate-900">
                {contractCount} Hợp đồng dự án
              </div>
              {!isPmRole && (
                <div className="text-sm text-slate-600">
                  Tổng giá trị lũy kế:{" "}
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {formatMoney(totalContractValue)}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">
                Đầu mối Kỹ thuật (Phối hợp UAT & Nghiệm thu Mốc)
              </div>
              <div className="text-base font-semibold text-slate-900">
                {apiDetail.tech_contact?.name || "—"}
                {apiDetail.tech_contact?.title ? ` — ${apiDetail.tech_contact.title}` : ""}
              </div>
              <div className="text-sm text-slate-600">
                SĐT: {apiDetail.tech_contact?.phone || "—"} • Email:{" "}
                {apiDetail.tech_contact?.email || "—"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
              <div className="text-xs font-medium text-slate-500">
                Đầu mối Kế toán (Tạm ứng, Tất toán & Nhận Hóa đơn VAT)
              </div>
              <div className="text-base font-semibold text-slate-900">
                {apiDetail.accounting_contact?.name || "—"}
                {apiDetail.accounting_contact?.title
                  ? ` — ${apiDetail.accounting_contact.title}`
                  : ""}
              </div>
              <div className="text-sm text-slate-600">
                SĐT: {apiDetail.accounting_contact?.phone || "—"} • Email:{" "}
                {apiDetail.accounting_contact?.email || "—"}
              </div>
            </div>
          </div>

          {apiDetail.note && (
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-start gap-2.5">
              <IconNotes className="size-4 text-slate-400 mt-0.5 shrink-0" />
              <div className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">Ghi chú đặc thù khách hàng: </span>
                {apiDetail.note}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 text-base font-semibold text-slate-900">
              Danh Sách Hợp Đồng Đã Ký ({detailContracts.length} Hợp đồng)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                    <th className="py-3 pl-5 pr-3 font-medium">Mã HĐ</th>
                    <th className="py-3 px-3 font-medium">Tên Dự án</th>
                    <th className="py-3 px-3 font-medium">AM / PM</th>
                    <th className="py-3 px-3 font-medium">Giai đoạn</th>
                    {!isPmRole && (
                      <th className="py-3 px-3 text-right font-medium">Giá trị HĐ</th>
                    )}
                    <th className="py-3 pl-3 pr-5 text-right font-medium">Mở dự án</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {detailContracts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isPmRole ? 5 : 6}
                        className="py-8 text-center text-slate-500 text-xs"
                      >
                        Khách hàng chưa có hợp đồng nào.
                      </td>
                    </tr>
                  ) : (
                    detailContracts.map((ct) => (
                      <tr
                        key={ct.contract_id}
                        onClick={() => ct.contract_id && openContractDetail(ct.contract_id)}
                        className="hover:bg-slate-50/90 cursor-pointer whitespace-nowrap"
                      >
                        <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-slate-500">
                          {ct.code}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-slate-900">{ct.name}</td>
                        <td className="py-3.5 px-3 text-slate-700 text-xs">
                          AM: {ct.am_name || "—"} • PM: {ct.pm_name || "—"}
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {formatPhaseVi(ct.phase)}
                          </span>
                        </td>
                        {!isPmRole && (
                          <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                            {formatMoney(
                              Number(ct.base_contract_value || 0) +
                                Number(ct.approved_upsell_value || 0)
                            )}
                          </td>
                        )}
                        <td className="py-3.5 pl-3 pr-5 text-right">
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900">
                            Mở <IconArrowRight className="size-4" />
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-3">
        <div className="text-base font-semibold text-slate-900">
          Không tìm thấy hồ sơ khách hàng
        </div>
        <p className="text-sm text-slate-500">
          Khách hàng này không tồn tại hoặc đã bị xóa khỏi danh bạ.
        </p>
        <div>
          <Button variant="outline" size="sm" onClick={closeCustomerDetail}>
            <IconArrowLeft className="size-4 mr-1.5" />
            Quay lại Danh bạ Khách hàng
          </Button>
        </div>
      </div>
    )
  }

  const renderListContent = () => (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Danh bạ Khách hàng
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Quản lý Khách hàng Doanh nghiệp, Mã số thuế & Đầu mối Kỹ thuật (Nghiệm thu) / Kế toán
            (Hóa đơn VAT)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-80">
            <IconSearch className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Tìm mã KH, tên công ty, MST, liên hệ..."
              className="pl-9 pr-8 h-9 text-sm bg-white border-slate-200"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Xóa tìm kiếm"
                onClick={() => {
                  setSearchQuery("")
                  setPage(1)
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>

          {canManageCustomer && (
            <Button
              onClick={openCreateModal}
              className="h-9 px-4 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white gap-1.5 rounded-lg"
            >
              <IconPlus className="size-4" />
              Thêm Khách hàng
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 font-medium">Mã KH</th>
                <th className="py-3 px-3 font-medium">Tên Doanh nghiệp</th>
                <th className="py-3 px-3 font-medium">Mã số thuế</th>
                <th className="py-3 px-3 font-medium">Đầu mối Kỹ thuật (UAT)</th>
                <th className="py-3 px-3 font-medium">Đầu mối Kế toán (Nhận HĐ VAT)</th>
                <th className="py-3 px-3 text-center font-medium">Số Dự án</th>
                {!isPmRole && (
                  <th className="py-3 px-3 text-right font-medium">Tổng quy mô HĐ</th>
                )}
                <th className="py-3 pl-3 pr-5 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {customersQuery.isLoading ? (
                <tr>
                  <td colSpan={isPmRole ? 7 : 8} className="py-10 text-center text-slate-500">
                    Đang tải danh bạ khách hàng...
                  </td>
                </tr>
              ) : apiCustomers.length === 0 ? (
                <tr>
                  <td colSpan={isPmRole ? 7 : 8} className="py-10 text-center text-slate-500">
                    {searchQuery.trim()
                      ? "Không tìm thấy khách hàng phù hợp với từ khóa."
                      : "Chưa có khách hàng nào trong danh bạ. Hãy bấm Thêm Khách hàng!"}
                  </td>
                </tr>
              ) : (
                apiCustomers.map((cust) => {
                    const custId = cust.customer_id || ""
                    const contractCount = Number(cust.contract_count || 0)

                    return (
                      <tr
                        key={custId}
                        onClick={() => custId && openCustomerDetail(custId)}
                        className="hover:bg-slate-50/90 cursor-pointer transition-colors group whitespace-nowrap"
                      >
                        <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-slate-500">
                          {cust.code}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-900 group-hover:underline">
                            {cust.name}
                          </div>
                          {cust.industry && (
                            <div className="text-xs text-slate-500 mt-0.5">{cust.industry}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-3 font-mono text-xs text-slate-600">
                          {cust.tax_code || "—"}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <PersonAvatar name={cust.tech_contact?.name || "KT"} />
                            <span className="font-medium text-slate-900">
                              {cust.tech_contact?.name || "—"}
                            </span>
                            {cust.tech_contact?.phone && (
                              <span className="text-xs text-slate-500">
                                ({cust.tech_contact.phone})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="text-slate-800">
                            {cust.accounting_contact?.name || "—"}
                          </span>{" "}
                          {cust.accounting_contact?.email && (
                            <span className="text-xs text-slate-500">
                              • {cust.accounting_contact.email}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                            {contractCount} dự án
                          </span>
                        </td>
                        {!isPmRole && (
                          <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                            {formatMoney(Number(cust.total_contract_value || 0))}
                          </td>
                        )}
                        <td
                          className="py-3.5 pl-3 pr-5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Xem chi tiết khách hàng"
                              className="h-8 px-2 text-xs text-slate-700 hover:text-slate-900"
                              onClick={() => custId && openCustomerDetail(custId)}
                            >
                              <IconEye className="size-3.5 mr-1" />
                              Xem
                            </Button>
                            {canManageCustomer && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Chỉnh sửa thông tin khách hàng"
                                  className="h-8 px-2 text-xs text-slate-700 hover:text-slate-900"
                                  onClick={() =>
                                    openEditModal({
                                      id: custId,
                                      code: cust.code || "",
                                      name: cust.name || "",
                                      taxCode: cust.tax_code || "",
                                      industry: cust.industry || "",
                                      address: cust.address || "",
                                      note: cust.note || "",
                                      techName: cust.tech_contact?.name || "",
                                      techTitle: cust.tech_contact?.title || "",
                                      techPhone: cust.tech_contact?.phone || "",
                                      techEmail: cust.tech_contact?.email || "",
                                      accName: cust.accounting_contact?.name || "",
                                      accTitle: cust.accounting_contact?.title || "",
                                      accPhone: cust.accounting_contact?.phone || "",
                                      accEmail: cust.accounting_contact?.email || "",
                                    })
                                  }
                                >
                                  <IconEdit className="size-3.5 mr-1" />
                                  Sửa
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Xóa khách hàng"
                                  className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  onClick={() =>
                                    setDeletingCustomer({
                                      id: custId,
                                      code: cust.code || "—",
                                      name: cust.name || "Khách hàng",
                                      taxCode: cust.tax_code || "—",
                                      contractCount,
                                    })
                                  }
                                >
                                  <IconTrash className="size-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-slate-100">
          <StandardPagination
            page={apiPagination.page || page}
            totalPages={apiPagination.totalPages || 1}
            totalCount={apiPagination.total || 0}
            limit={apiPagination.limit || limit}
            onPageChange={setPage}
            isLoading={customersQuery.isFetching}
            unit="khách hàng"
          />
        </div>
      </div>
    </div>
  )

  return (
    <>
      {selectedCustomerId ? renderDetailContent() : renderListContent()}

      {/* Modal Thêm / Sửa Khách Hàng (dùng chung cho cả List & Detail) */}
      <Dialog open={customerModalOpen} onOpenChange={setCustomerModalOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingCustomerId
                ? "Cập nhật Hồ sơ Khách hàng & 2 Đầu mối"
                : "Thêm Khách Hàng Mới"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Quản lý thông tin pháp nhân xuất hóa đơn và 2 đầu mối phối hợp dự án (Kỹ thuật & Kế
              toán).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Tên doanh nghiệp *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Công ty Cổ phần Đầu tư..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mã khách hàng</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="Tự sinh (KH-xxxx)"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Mã số thuế *</Label>
                <Input
                  value={form.taxCode}
                  onChange={(e) => setForm((f) => ({ ...f, taxCode: e.target.value }))}
                  placeholder="031..."
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Ngành nghề / Lĩnh vực</Label>
                <Input
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
                  placeholder="Bất động sản / Logistics / Tài chính..."
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-3">
                <Label className="text-xs">Địa chỉ xuất hóa đơn</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1 sm:col-span-3">
                <Label className="text-xs">Ghi chú đặc thù khách hàng</Label>
                <Textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="VD: Chu kỳ đối soát hóa đơn ngày 25 hàng tháng, yêu cầu gửi biên bản bản cứng..."
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-2.5 bg-slate-50/50">
              <div className="font-semibold text-slate-800">
                1. Đầu mối Kỹ thuật (Nghiệm thu UAT)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  value={form.techName}
                  onChange={(e) => setForm((f) => ({ ...f, techName: e.target.value }))}
                  placeholder="Họ và tên"
                  className="h-8 text-xs bg-white"
                />
                <Input
                  value={form.techTitle}
                  onChange={(e) => setForm((f) => ({ ...f, techTitle: e.target.value }))}
                  placeholder="Chức danh (VD: CIO / IT Manager)"
                  className="h-8 text-xs bg-white"
                />
                <Input
                  value={form.techPhone}
                  onChange={(e) => setForm((f) => ({ ...f, techPhone: e.target.value }))}
                  placeholder="Số điện thoại"
                  className="h-8 text-xs bg-white"
                />
                <Input
                  value={form.techEmail}
                  onChange={(e) => setForm((f) => ({ ...f, techEmail: e.target.value }))}
                  placeholder="tech@company.vn"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 space-y-2.5 bg-slate-50/50">
              <div className="font-semibold text-slate-800">
                2. Đầu mối Kế toán (Thanh toán & Hóa đơn VAT)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <Input
                  value={form.accName}
                  onChange={(e) => setForm((f) => ({ ...f, accName: e.target.value }))}
                  placeholder="Họ tên kế toán"
                  className="h-8 text-xs bg-white"
                />
                <Input
                  value={form.accTitle}
                  onChange={(e) => setForm((f) => ({ ...f, accTitle: e.target.value }))}
                  placeholder="Chức danh (Kế toán trưởng / Thanh toán)"
                  className="h-8 text-xs bg-white"
                />
                <Input
                  value={form.accPhone}
                  onChange={(e) => setForm((f) => ({ ...f, accPhone: e.target.value }))}
                  placeholder="Số điện thoại"
                  className="h-8 text-xs bg-white"
                />
                <Input
                  value={form.accEmail}
                  onChange={(e) => setForm((f) => ({ ...f, accEmail: e.target.value }))}
                  placeholder="accounting@company.vn"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCustomerModalOpen(false)
                setEditingCustomerId(null)
              }}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={createMutation.isPending || updateMutation.isPending}
              onClick={handleSaveCustomer}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Đang lưu..."
                : editingCustomerId
                  ? "Lưu Cập Nhật"
                  : "Thêm Khách Hàng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Xác nhận Xóa Khách Hàng */}
      <Dialog
        open={Boolean(deletingCustomer)}
        onOpenChange={(open) => {
          if (!open) setDeletingCustomer(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-slate-900">
              Xác nhận xóa khách hàng
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Kiểm tra ràng buộc hợp đồng trước khi xóa mềm khách hàng khỏi danh bạ.
            </DialogDescription>
          </DialogHeader>

          {deletingCustomer && (
            <div className="space-y-3 py-1 text-sm">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div className="font-semibold text-slate-900">{deletingCustomer.name}</div>
                <div className="text-xs text-slate-600">
                  Mã KH: <span className="font-mono">{deletingCustomer.code}</span> • MST:{" "}
                  <span className="font-mono">{deletingCustomer.taxCode}</span>
                </div>
              </div>

              {deletingCustomer.contractCount > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5 text-xs text-amber-900">
                  <IconAlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    Khách hàng đang có{" "}
                    <span className="font-semibold">
                      {deletingCustomer.contractCount} hợp đồng
                    </span>{" "}
                    liên kết. Hệ thống chặn thao tác xóa để bảo toàn dữ liệu tài chính & lịch sử dự
                    án.
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed">
                  Bạn có chắc chắn muốn xóa khách hàng này? Sau khi xóa, khách hàng sẽ không còn
                  xuất hiện trong danh bạ và danh sách chọn khi khởi tạo hợp đồng mới.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => setDeletingCustomer(null)}
            >
              Đóng
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={
                deleteMutation.isPending || (deletingCustomer?.contractCount || 0) > 0
              }
              onClick={handleConfirmDelete}
            >
              {deleteMutation.isPending
                ? "Đang xóa..."
                : (deletingCustomer?.contractCount || 0) > 0
                  ? "Đang có Hợp đồng — Không thể xóa"
                  : "Xác nhận Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
