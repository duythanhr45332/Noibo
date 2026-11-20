"use client"

import * as React from "react"
import Link from "next/link"
import { FastLink } from "@/lib/fast-nav"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  IconArrowLeft,
  IconEdit,
  IconLock,
  IconLockOpen,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconUserCog,
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StandardPagination } from "@/components/ui/standard-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/components/providers/auth-provider"
import {
  useGetApiV1Users,
  usePatchApiV1UsersIdStatus,
  usePostApiV1Users,
  usePutApiV1UsersId,
} from "@/lib/api/generated/users/users"
import { useGetApiV1Roles } from "@/lib/api/generated/roles/roles"
import type { UserProfile as ApiUserItem } from "@/lib/api/model"

const ROLE_OPTIONS = ["ADMIN", "BOD", "ACCOUNTANT", "AM", "PM"] as const
type SystemRole = (typeof ROLE_OPTIONS)[number]

const ROLE_BADGE_MAP: Record<SystemRole, { label: string; className: string }> = {
  ADMIN: { label: "ADMIN", className: "bg-slate-900 text-white border-slate-900" },
  BOD: { label: "BOD (Ban GĐ)", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  ACCOUNTANT: { label: "Kế toán", className: "bg-amber-100 text-amber-800 border-amber-200" },
  AM: { label: "AM", className: "bg-blue-100 text-blue-800 border-blue-200" },
  PM: { label: "PM", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
}

const createUserFormSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Tên đăng nhập tối thiểu 3 ký tự")
    .max(50, "Tên đăng nhập tối đa 50 ký tự")
    .regex(/^[a-zA-Z0-9._-]+$/, "Chỉ cho phép chữ, số, dấu chấm, gạch dưới, gạch nối"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  full_name: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự"),
  department: z.string().trim().max(150).optional(),
  role: z.enum(ROLE_OPTIONS),
})

const editUserFormSchema = z.object({
  full_name: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự"),
  department: z.string().trim().max(150).optional(),
  role: z.enum(ROLE_OPTIONS),
  new_password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 6, "Mật khẩu đặt lại tối thiểu 6 ký tự"),
})

type CreateUserFormValues = z.infer<typeof createUserFormSchema>
type EditUserFormValues = z.infer<typeof editUserFormSchema>

function extractApiError(err: unknown): {
  fieldErrors: Array<{ field?: string; message?: string }>
  fallbackMessage: string
} {
  const axiosErr = err as {
    response?: {
      data?: {
        errors?: Array<{ field?: string; message?: string }>
        message?: string
      }
    }
  }
  const errors = axiosErr?.response?.data?.errors || []
  const fallbackMessage =
    errors[0]?.message ||
    axiosErr?.response?.data?.message ||
    "Thao tác thất bại, vui lòng thử lại"
  return { fieldErrors: errors, fallbackMessage }
}

export function UserManagementView() {
  const queryClient = useQueryClient()
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth()

  const canManageUsers =
    isAuthenticated &&
    (user?.role === "ADMIN" || user?.role === "BOD")

  const [page, setPage] = React.useState(1)
  const [searchInput, setSearchInput] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>("ALL")
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL")

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<ApiUserItem | null>(null)

  const limit = 10

  const usersQuery = useGetApiV1Users(
    {
      page,
      limit,
      search: searchQuery || undefined,
      role: roleFilter !== "ALL" ? (roleFilter as SystemRole) : undefined,
      is_active:
        statusFilter === "ACTIVE"
          ? "true"
          : statusFilter === "LOCKED"
            ? "false"
            : undefined,
    },
    {
      query: {
        enabled: canManageUsers,
      },
    }
  )

  const rolesQuery = useGetApiV1Roles({
    query: {
      enabled: canManageUsers,
    },
  })

  const createMutation = usePostApiV1Users()
  const updateMutation = usePutApiV1UsersId()
  const toggleStatusMutation = usePatchApiV1UsersIdStatus()

  const createForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      username: "",
      password: "",
      full_name: "",
      department: "",
      role: "AM",
    },
  })

  const editForm = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      full_name: "",
      department: "",
      role: "AM",
      new_password: "",
    },
  })

  React.useEffect(() => {
    if (editingUser) {
      editForm.reset({
        full_name: editingUser.full_name || "",
        department: editingUser.department || "",
        role: (editingUser.role as SystemRole) || "AM",
        new_password: "",
      })
    }
  }, [editingUser, editForm])

  const invalidateUsers = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] })
    queryClient.invalidateQueries({ queryKey: ["/api/v1/users/options"] })
  }, [queryClient])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    setSearchQuery(searchInput.trim())
  }

  const handleCreateSubmit = async (values: CreateUserFormValues) => {
    try {
      await createMutation.mutateAsync({
        data: {
          username: values.username.trim().toLowerCase(),
          password: values.password,
          full_name: values.full_name.trim(),
          department: values.department?.trim() || null,
          role: values.role,
          is_active: true,
        },
      })
      toast.success(`Đã tạo tài khoản "${values.username}"`)
      createForm.reset()
      setCreateOpen(false)
      invalidateUsers()
    } catch (err) {
      const { fieldErrors, fallbackMessage } = extractApiError(err)
      fieldErrors.forEach((fe) => {
        if (
          fe.field === "username" ||
          fe.field === "password" ||
          fe.field === "full_name" ||
          fe.field === "department" ||
          fe.field === "role"
        ) {
          createForm.setError(fe.field, { message: fe.message || fallbackMessage })
        }
      })
      toast.error(fallbackMessage)
    }
  }

  const handleEditSubmit = async (values: EditUserFormValues) => {
    if (!editingUser?.user_id) return
    try {
      await updateMutation.mutateAsync({
        id: editingUser.user_id,
        data: {
          full_name: values.full_name.trim(),
          department: values.department?.trim() || null,
          role: values.role,
          new_password: values.new_password?.trim() || undefined,
        },
      })
      toast.success(`Đã cập nhật tài khoản "${editingUser.username}"`)
      setEditingUser(null)
      invalidateUsers()
    } catch (err) {
      const { fieldErrors, fallbackMessage } = extractApiError(err)
      fieldErrors.forEach((fe) => {
        if (
          fe.field === "full_name" ||
          fe.field === "department" ||
          fe.field === "role" ||
          fe.field === "new_password"
        ) {
          editForm.setError(fe.field, { message: fe.message || fallbackMessage })
        }
      })
      toast.error(fallbackMessage)
    }
  }

  const handleToggleStatus = async (target: ApiUserItem) => {
    if (!target.user_id) return
    const nextActive = !target.is_active
    try {
      await toggleStatusMutation.mutateAsync({
        id: target.user_id,
        data: { is_active: nextActive },
      })
      toast.success(
        nextActive
          ? `Đã mở khóa tài khoản "${target.username}"`
          : `Đã khóa tài khoản "${target.username}" và thu hồi phiên đăng nhập`
      )
      invalidateUsers()
    } catch (err) {
      const { fallbackMessage } = extractApiError(err)
      toast.error(fallbackMessage)
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex-1 p-6 lg:p-8 flex items-center justify-center text-sm text-slate-500">
        Đang kiểm tra quyền truy cập...
      </div>
    )
  }

  if (!canManageUsers) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50/60">
        <div className="max-w-xl mx-auto mt-10">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <IconShieldCheck className="size-5 text-amber-600" />
                Yêu cầu đăng nhập quyền Quản trị (ADMIN / BOD)
              </CardTitle>
              <CardDescription>
                {!isAuthenticated
                  ? "Vui lòng đăng nhập bằng tài khoản ADMIN hoặc BOD để quản lý nhân sự nội bộ."
                  : `Tài khoản "${user?.username}" (${user?.role}) không có quyền quản trị tài khoản.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline">
                <FastLink href="/">
                  <IconArrowLeft className="size-4 mr-1.5" />
                  Quay lại Bảng điều khiển
                </FastLink>
              </Button>
              {!isAuthenticated && (
                <Button asChild>
                  <Link href="/login">Đăng nhập ngay</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const items = usersQuery.data?.data?.items || []
  const pagination = usersQuery.data?.data?.pagination || {
    page,
    limit,
    total: 0,
    totalPages: 1,
  }
  const roleDefinitions = rolesQuery.data?.data || []

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50/50">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Link href="/" className="hover:text-slate-900 inline-flex items-center gap-1">
                <IconArrowLeft className="size-3.5" />
                Trang chủ ERP-AM
              </Link>
              <span>/</span>
              <span className="text-slate-900 font-medium">Quản lý Tài khoản</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <IconUserCog className="size-6 text-primary" />
              Nhân sự & Phân quyền (RBAC)
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Quản lý tài khoản 5 vai trò chuẩn: ADMIN, BOD, Kế toán (ACCOUNTANT), AM và PM.
            </p>
          </div>

          <Button
            onClick={() => {
              createForm.reset({
                username: "",
                password: "",
                full_name: "",
                department: "",
                role: "AM",
              })
              setCreateOpen(true)
            }}
            className="gap-1.5"
          >
            <IconPlus className="size-4" />
            Thêm tài khoản
          </Button>
        </div>

        {/* Bộ lọc tìm kiếm */}
        <Card>
          <CardContent className="pt-5">
            <form
              onSubmit={handleSearchSubmit}
              className="grid grid-cols-1 md:grid-cols-12 gap-3"
            >
              <div className="md:col-span-5 relative">
                <IconSearch className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm theo username, họ tên, phòng ban..."
                  className="pl-9"
                />
              </div>

              <div className="md:col-span-3">
                <Select
                  value={roleFilter}
                  onValueChange={(v) => {
                    setRoleFilter(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tất cả vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả vai trò</SelectItem>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_BADGE_MAP[r].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v)
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Mọi trạng thái</SelectItem>
                    <SelectItem value="ACTIVE">Đang hoạt động</SelectItem>
                    <SelectItem value="LOCKED">Đã khóa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 flex gap-2">
                <Button type="submit" variant="secondary" className="w-full">
                  Lọc
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Bảng danh sách */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="pl-6">Tên đăng nhập</TableHead>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Phòng ban / Nhóm</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right pr-6">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                      Đang tải danh sách tài khoản...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                      Không tìm thấy tài khoản phù hợp với bộ lọc.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((u) => {
                    const roleKey = (u.role as SystemRole) || "AM"
                    const badgeMeta = ROLE_BADGE_MAP[roleKey] || {
                      label: u.role || "AM",
                      className: "bg-slate-100 text-slate-800",
                    }
                    const isSelf = u.user_id === user?.user_id
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell className="pl-6 font-mono text-xs font-semibold text-slate-900">
                          {u.username}
                          {isSelf && (
                            <span className="ml-2 text-[10px] font-sans bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                              Bạn
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {u.full_name}
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs">
                          {u.department || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badgeMeta.className}>
                            {badgeMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.is_active ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              Hoạt động
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-red-50 text-red-700 border-red-200"
                            >
                              Đã khóa
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2.5 text-xs"
                              onClick={() => setEditingUser(u)}
                            >
                              <IconEdit className="size-3.5 mr-1" />
                              Sửa
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isSelf || toggleStatusMutation.isPending}
                              title={
                                isSelf
                                  ? "Không thể tự khóa tài khoản đang đăng nhập"
                                  : u.is_active
                                    ? "Khóa tài khoản"
                                    : "Mở khóa tài khoản"
                              }
                              className={`h-8 px-2.5 text-xs ${u.is_active
                                  ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                }`}
                              onClick={() => handleToggleStatus(u)}
                            >
                              {u.is_active ? (
                                <>
                                  <IconLock className="size-3.5 mr-1" />
                                  Khóa
                                </>
                              ) : (
                                <>
                                  <IconLockOpen className="size-3.5 mr-1" />
                                  Mở khóa
                                </>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>

            <div className="px-6 py-4 border-t border-slate-100">
              <StandardPagination
                page={pagination.page || page}
                totalPages={pagination.totalPages || 1}
                totalCount={pagination.total || 0}
                limit={pagination.limit || limit}
                onPageChange={setPage}
                isLoading={usersQuery.isFetching}
                unit="tài khoản"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bảng chú thích 5 vai trò chuẩn */}
        {roleDefinitions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800">
                Tham chiếu 5 vai trò chuẩn (RBAC)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
              {roleDefinitions.map((rd) => (
                <div
                  key={rd.code}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1"
                >
                  <div className="font-semibold text-slate-900">{rd.name}</div>
                  <div className="text-slate-600 leading-relaxed">{rd.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal Tạo mới */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Tạo tài khoản nhân sự</DialogTitle>
            <DialogDescription>
              Cấp tài khoản đăng nhập cho AM, PM, Kế toán, BOD hoặc Admin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="create-username">Tên đăng nhập *</Label>
              <Input
                id="create-username"
                placeholder="vd: thao.am"
                {...createForm.register("username")}
              />
              {createForm.formState.errors.username && (
                <p className="text-xs text-red-600">
                  {createForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-fullname">Họ và tên *</Label>
              <Input
                id="create-fullname"
                placeholder="Nguyễn Phương Thảo"
                {...createForm.register("full_name")}
              />
              {createForm.formState.errors.full_name && (
                <p className="text-xs text-red-600">
                  {createForm.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vai trò *</Label>
                <Select
                  value={createForm.watch("role")}
                  onValueChange={(v) => createForm.setValue("role", v as SystemRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_BADGE_MAP[r].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {createForm.formState.errors.role && (
                  <p className="text-xs text-red-600">
                    {createForm.formState.errors.role.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-dept">Phòng ban / Nhóm</Label>
                <Input
                  id="create-dept"
                  placeholder="Khối AM / Tech"
                  {...createForm.register("department")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-password">Mật khẩu khởi tạo *</Label>
              <Input
                id="create-password"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                {...createForm.register("password")}
              />
              {createForm.formState.errors.password && (
                <p className="text-xs text-red-600">
                  {createForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Đang tạo..." : "Tạo tài khoản"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Chỉnh sửa */}
      <Dialog open={Boolean(editingUser)} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              Cập nhật tài khoản:{" "}
              <span className="font-mono text-primary">{editingUser?.username}</span>
            </DialogTitle>
            <DialogDescription>
              Chỉnh sửa họ tên, phòng ban, vai trò hoặc đặt lại mật khẩu mới.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-fullname">Họ và tên *</Label>
              <Input id="edit-fullname" {...editForm.register("full_name")} />
              {editForm.formState.errors.full_name && (
                <p className="text-xs text-red-600">
                  {editForm.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vai trò *</Label>
                <Select
                  value={editForm.watch("role")}
                  onValueChange={(v) => editForm.setValue("role", v as SystemRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_BADGE_MAP[r].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.formState.errors.role && (
                  <p className="text-xs text-red-600">
                    {editForm.formState.errors.role.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-dept">Phòng ban / Nhóm</Label>
                <Input id="edit-dept" {...editForm.register("department")} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-password">Đặt lại mật khẩu mới (tuỳ chọn)</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="Bỏ trống nếu giữ nguyên mật khẩu hiện tại"
                {...editForm.register("new_password")}
              />
              {editForm.formState.errors.new_password && (
                <p className="text-xs text-red-600">
                  {editForm.formState.errors.new_password.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingUser(null)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
