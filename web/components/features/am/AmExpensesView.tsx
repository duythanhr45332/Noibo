"use client"

import * as React from "react"
import {
  IconCheck,
  IconEdit,
  IconPlus,
  IconSearch,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import {
  AmExpenseCategory,
  AmExpenseItem,
  calculateContractMetrics,
  ContractProject,
} from "@/lib/mock/am-types"
import { cn } from "@/lib/utils"

const CATEGORY_LABELS: Record<
  AmExpenseCategory,
  { label: string; badgeClass: string }
> = {
  TAXI: {
    label: "Taxi / Di chuyển",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
  },
  SHIP: {
    label: "Ship HĐ / Hóa đơn",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  SHIPPING: {
    label: "Ship HĐ / Hóa đơn",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  HOSPITALITY: {
    label: "Tiếp khách / Cafe UAT",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  CLIENT_MEETING: {
    label: "Tiếp khách / Họp KH",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
  PRINTING: {
    label: "In ấn tài liệu / BBNT",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
  OTHER: {
    label: "Chi phí khác",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
}

interface FlattenedExpenseRow {
  contract: ContractProject
  expense: AmExpenseItem
}

export function AmExpensesView() {
  const {
    contracts,
    formatMoney,
    openContractDetail,
    updateAmAdvanceAmount,
    addAmExpense,
    toggleAmExpenseStatus,
  } = useAmPrototype()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [projectFilter, setProjectFilter] = React.useState<string>("ALL")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("ALL")

  // Modal Cập nhật Tiền công ty cấp tạm ứng trước cho AM
  const [editingAdvanceContract, setEditingAdvanceContract] =
    React.useState<ContractProject | null>(null)
  const [advanceDraftVnd, setAdvanceDraftVnd] = React.useState("")

  // Modal + Ghi khoản chi AM mới (Taxi, Ship, Tiếp khách...)
  const [addExpenseOpen, setAddExpenseOpen] = React.useState(false)
  const [expContractId, setExpContractId] = React.useState(
    contracts[0]?.id || ""
  )
  const [expCategory, setExpCategory] =
    React.useState<AmExpenseCategory>("TAXI")
  const [expDate, setExpDate] = React.useState(
    new Date().toISOString().slice(0, 10)
  )
  const [expMilestoneCode, setExpMilestoneCode] = React.useState("M1")
  const [expAmountVnd, setExpAmountVnd] = React.useState("180000")
  const [expDescription, setExpDescription] = React.useState("")

  const filteredContracts = React.useMemo(() => {
    return contracts.filter((c) => {
      if (projectFilter !== "ALL" && c.id !== projectFilter) return false
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase()
        return (
          c.projectName.toLowerCase().includes(q) ||
          c.contractCode.toLowerCase().includes(q) ||
          c.customerName.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [contracts, projectFilter, searchQuery])

  const projectAdvanceSummary = React.useMemo(() => {
    let totalAdvanceVnd = 0
    let totalSpentVnd = 0

    filteredContracts.forEach((c) => {
      const m = calculateContractMetrics(c)
      totalAdvanceVnd += m.amAdvanceVnd
      totalSpentVnd += m.amTotalSpentVnd
    })

    return {
      totalAdvanceVnd,
      totalSpentVnd,
      totalRemainingVnd: totalAdvanceVnd - totalSpentVnd,
    }
  }, [filteredContracts])

  const allExpenseRows = React.useMemo<FlattenedExpenseRow[]>(() => {
    const list: FlattenedExpenseRow[] = []
    contracts.forEach((c) => {
      if (projectFilter !== "ALL" && c.id !== projectFilter) return
      ;(c.amExpenses || []).forEach((exp) => {
        if (categoryFilter !== "ALL" && exp.category !== categoryFilter) return
        if (searchQuery.trim() !== "") {
          const q = searchQuery.toLowerCase()
          const match =
            exp.description.toLowerCase().includes(q) ||
            c.projectName.toLowerCase().includes(q) ||
            c.contractCode.toLowerCase().includes(q) ||
            (exp.milestoneCode || "").toLowerCase().includes(q)
          if (!match) return
        }
        list.push({
          contract: c,
          expense: exp,
        })
      })
    })
    return list
  }, [contracts, projectFilter, categoryFilter, searchQuery])

  const totalLedgerAmountVnd = React.useMemo(
    () => allExpenseRows.reduce((acc, r) => acc + r.expense.amountVnd, 0),
    [allExpenseRows]
  )

  const handleSaveAdvance = () => {
    if (!editingAdvanceContract) return
    const val = Math.max(0, Number(advanceDraftVnd) || 0)
    updateAmAdvanceAmount(editingAdvanceContract.id, val)
    setEditingAdvanceContract(null)
  }

  const handleCreateExpense = () => {
    if (!expDescription.trim()) {
      toast.error("Vui lòng nhập nội dung khoản chi (VD: Taxi đi họp UAT)")
      return
    }
    const amt = Math.max(1000, Number(expAmountVnd) || 0)
    addAmExpense(expContractId, {
      date: expDate,
      category: expCategory,
      milestoneCode: expMilestoneCode || "Chung",
      description: expDescription.trim(),
      amountVnd: amt,
      status: "RECORDED",
      createdBy: "AM Thảo",
    })
    setExpDescription("")
    setAddExpenseOpen(false)
  }

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Quỹ Tạm Ứng & Chi Phí Công Tác AM
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Sổ Tạm Ứng & Chi Phí Công Tác AM (Taxi, Ship Hợp đồng/Hóa đơn, Tiếp khách) — Tách biệt 100% với Quỹ Ngày Công & Thưởng 50/50
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <IconSearch className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm khoản chi taxi, ship, dự án..."
              className="pl-9 h-9 text-sm bg-white border-slate-200"
            />
          </div>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-60 h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Tất cả Dự án" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">
                Tất cả Dự án ({contracts.length})
              </SelectItem>
              {contracts.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-sm">
                  {c.contractCode} — {c.projectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48 h-9 text-sm bg-white border-slate-200">
              <SelectValue placeholder="Mọi hạng mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Mọi hạng mục chi</SelectItem>
              <SelectItem value="TAXI">Taxi / Di chuyển</SelectItem>
              <SelectItem value="SHIP">Ship HĐ / Hóa đơn</SelectItem>
              <SelectItem value="HOSPITALITY">Tiếp khách / Cafe nghiệm thu</SelectItem>
              <SelectItem value="PRINTING">In ấn tài liệu</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={() => setAddExpenseOpen(true)}
            className="h-9 px-4 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 rounded-lg"
          >
            <IconPlus className="size-4" />
            Ghi khoản chi AM
          </Button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TABLE 1: ĐỐI SOÁT QUỸ TẠM ỨNG AM THEO DỰ ÁN (3 CHỈ SỐ RÕ RÀNG)      */}
      {/* =================================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              1. Bảng Đối Soát Quỹ Tạm Ứng Công Tác AM Theo Dự Án
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Công thức đối soát Kế toán: (1) Tiền công ty cấp tạm ứng trước − (2) Tổng AM đã thực chi = (3) Số dư còn lại (hoặc Công ty cần hoàn ứng thêm cho AM)
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 font-medium">Mã HĐ</th>
                <th className="py-3 px-3 font-medium">Dự án</th>
                <th className="py-3 px-3 font-medium">Khách hàng</th>
                <th className="py-3 px-3 text-center font-medium">
                  Số khoản chi
                </th>
                <th className="py-3 px-3 text-right font-medium">
                  1. Tiền công ty cấp tạm ứng
                </th>
                <th className="py-3 px-3 text-right font-medium">
                  2. Tổng AM đã thực chi
                </th>
                <th className="py-3 px-3 text-right font-medium">
                  3. Số dư còn lại / Cần hoàn thêm
                </th>
                <th className="py-3 px-3 font-medium">Trạng thái đối soát</th>
                <th className="py-3 pl-3 pr-5 text-right font-medium">
                  Cập nhật Tạm ứng
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredContracts.map((contract) => {
                const m = calculateContractMetrics(contract)
                const isDeficit = m.amReimburseNeededVnd > 0

                return (
                  <tr
                    key={contract.id}
                    className="hover:bg-slate-50/90 transition-colors whitespace-nowrap"
                  >
                    <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-slate-500">
                      {contract.contractCode}
                    </td>
                    <td className="py-3.5 px-3">
                      <button
                        type="button"
                        onClick={() => openContractDetail(contract.id)}
                        className="font-semibold text-slate-900 hover:underline"
                      >
                        {contract.projectName}
                      </button>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">
                      {contract.customerName}
                    </td>
                    <td className="py-3.5 px-3 text-center tabular-nums text-slate-600">
                      {(contract.amExpenses || []).length}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums font-medium text-slate-900">
                      {formatMoney(m.amAdvanceVnd)}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                      {formatMoney(m.amTotalSpentVnd)}
                    </td>
                    <td
                      className={cn(
                        "py-3.5 px-3 text-right tabular-nums font-semibold",
                        isDeficit ? "text-red-600" : "text-slate-900"
                      )}
                    >
                      {isDeficit
                        ? `-${formatMoney(m.amReimburseNeededVnd)}`
                        : `+${formatMoney(m.amRemainingAdvanceVnd)}`}
                    </td>
                    <td className="py-3.5 px-3">
                      {isDeficit ? (
                        <span className="inline-flex items-center rounded-md bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 border border-red-200/70">
                          Chi vượt tạm ứng • Cần hoàn thêm
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          Trong hạn mức tạm ứng
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs border-slate-200 text-slate-700 gap-1"
                        onClick={() => {
                          setEditingAdvanceContract(contract)
                          setAdvanceDraftVnd(String(m.amAdvanceVnd))
                        }}
                      >
                        <IconEdit className="size-3.5" />
                        Cấp tạm ứng
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TABLE 2: SỔ CHI TIẾT CÁC KHOẢN CHI AM (TAXI, SHIP, TIẾP KHÁCH...)    */}
      {/* =================================================================== */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-semibold text-slate-900">
              2. Sổ Chi Tiết Các Khoản Thực Chi Của AM (Taxi, Ship, Tiếp Khách...)
            </h2>
            <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {allExpenseRows.length} chứng từ
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddExpenseOpen(true)}
            className="h-8 text-xs border-slate-200 text-slate-700 gap-1"
          >
            <IconPlus className="size-3.5" />
            Thêm khoản chi
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                <th className="py-3 pl-5 pr-3 font-medium">Trạng thái</th>
                <th className="py-3 px-3 font-medium">Ngày chi</th>
                <th className="py-3 px-3 font-medium">Dự án</th>
                <th className="py-3 px-3 font-medium">Mốc liên quan</th>
                <th className="py-3 px-3 font-medium">Hạng mục</th>
                <th className="py-3 px-3 font-medium">Nội dung chi tiết</th>
                <th className="py-3 px-3 font-medium">Người chi</th>
                <th className="py-3 px-3 text-right font-medium">
                  Số tiền (VNĐ)
                </th>
                <th className="py-3 pl-3 pr-5 text-right font-medium">
                  Đối soát KT
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {allExpenseRows.map(({ contract, expense }) => {
                const catInfo =
                  CATEGORY_LABELS[expense.category] || CATEGORY_LABELS.OTHER
                const isReimbursed = expense.status === "REIMBURSED"

                return (
                  <tr
                    key={`${contract.id}-${expense.id}`}
                    className="hover:bg-slate-50/90 transition-colors whitespace-nowrap"
                  >
                    <td className="py-3.5 pl-5 pr-3">
                      {isReimbursed ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/70">
                          <IconCheck className="size-3.5" />
                          Đã hoàn ứng
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          Chờ KT quyết toán
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 tabular-nums text-slate-600">
                      {expense.date}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-500">
                      {contract.contractCode}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs font-semibold text-slate-700">
                      {expense.milestoneCode || "Chung"}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {catInfo.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 font-medium text-slate-900">
                      {expense.description}
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">
                      {expense.createdBy || "AM Thảo"}
                    </td>
                    <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                      {formatMoney(expense.amountVnd)}
                    </td>
                    <td className="py-3.5 pl-3 pr-5 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toggleAmExpenseStatus(contract.id, expense.id)
                        }
                        className="h-8 px-2.5 text-xs border-slate-200"
                      >
                        {isReimbursed ? "Hoàn tác" : "✓ Đã hoàn ứng"}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* DIALOG 1: CẬP NHẬT TIỀN CÔNG TY CẤP TẠM ỨNG TRƯỚC CHO AM            */}
      {/* =================================================================== */}
      <Dialog
        open={!!editingAdvanceContract}
        onOpenChange={(o) => !o && setEditingAdvanceContract(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Cập Nhật Tiền Công Ty Cấp Tạm Ứng Trước Cho AM (
              {editingAdvanceContract?.contractCode})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Nhập tổng số tiền mặt / chuyển khoản công ty đã cấp tạm ứng cho AM Thảo để chi tiêu công tác trong dự án này.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-xs">
            <Label className="text-xs">
              Số tiền công ty đã cấp tạm ứng (VNĐ)
            </Label>
            <Input
              type="number"
              value={advanceDraftVnd}
              onChange={(e) => setAdvanceDraftVnd(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingAdvanceContract(null)}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAdvance}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Lưu hạn mức tạm ứng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =================================================================== */}
      {/* DIALOG 2: + GHI KHOẢN CHI CÔNG TÁC AM MỚI                           */}
      {/* =================================================================== */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Ghi Khoản Chi Công Tác AM (Taxi, Ship, Tiếp Khách...)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Khoản chi này được trừ vào Sổ Tạm Ứng AM của dự án, không ảnh hưởng tới Quỹ Credit Mandays của đội Dev.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Thuộc Dự án</Label>
              <Select value={expContractId} onValueChange={setExpContractId}>
                <SelectTrigger className="h-8 text-xs mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.contractCode} — {c.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Hạng mục chi</Label>
                <Select
                  value={expCategory}
                  onValueChange={(v) => setExpCategory(v as AmExpenseCategory)}
                >
                  <SelectTrigger className="h-8 text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAXI">Taxi / Di chuyển</SelectItem>
                    <SelectItem value="SHIP">Ship HĐ / Hóa đơn</SelectItem>
                    <SelectItem value="HOSPITALITY">
                      Tiếp khách / Cafe UAT
                    </SelectItem>
                    <SelectItem value="PRINTING">In ấn tài liệu</SelectItem>
                    <SelectItem value="OTHER">Chi phí khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ngày chi</Label>
                <Input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Mốc liên quan (VD: M1, M2)</Label>
                <Input
                  value={expMilestoneCode}
                  onChange={(e) => setExpMilestoneCode(e.target.value)}
                  placeholder="M1"
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Số tiền thực chi (VNĐ) *</Label>
                <Input
                  type="number"
                  value={expAmountVnd}
                  onChange={(e) => setExpAmountVnd(e.target.value)}
                  className="h-8 text-xs font-mono mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Nội dung chi tiết *</Label>
              <Input
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                placeholder="VD: GrabCar đi họp nghiệm thu Mốc M1 tại văn phòng khách hàng..."
                className="h-8 text-xs mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddExpenseOpen(false)}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleCreateExpense}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Lưu khoản chi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
