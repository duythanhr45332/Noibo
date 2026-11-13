"use client"

import * as React from "react"
import {
  IconArrowLeft,
  IconArrowRight,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAmPrototype } from "@/components/providers/am-prototype-provider"
import { PersonAvatar } from "@/components/features/am/ProductiveHomeDashboard"
import { calculateContractMetrics } from "@/lib/mock/am-types"

export function CustomerListView() {
  const {
    customers,
    contracts,
    roleView,
    formatMoney,
    createCustomer,
    openContractDetail,
    setActiveScreen,
  } = useAmPrototype()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<
    string | null
  >(null)

  // Modal thêm khách hàng
  const [newCustomerModalOpen, setNewCustomerModalOpen] = React.useState(false)
  const [newCustName, setNewCustName] = React.useState("")
  const [newCustTax, setNewCustTax] = React.useState("")
  const [newCustTechName, setNewCustTechName] = React.useState("")
  const [newCustAccEmail, setNewCustAccEmail] = React.useState("")

  const selectedCustomer = React.useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  )

  const filteredCustomers = React.useMemo(() => {
    return customers.filter((c) => {
      if (searchQuery.trim() === "") return true
      const q = searchQuery.toLowerCase()
      return (
        c.companyName.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.taxCode.toLowerCase().includes(q) ||
        c.techContact.name.toLowerCase().includes(q)
      )
    })
  }, [customers, searchQuery])

  const handleCreateCustomer = () => {
    if (!newCustName.trim() || !newCustTax.trim()) {
      toast.error("Vui lòng nhập Tên doanh nghiệp và Mã số thuế")
      return
    }
    createCustomer({
      code: `KH-${newCustTax.slice(-4)}`,
      companyName: newCustName.trim(),
      taxCode: newCustTax.trim(),
      industry: "Doanh nghiệp",
      address: "TP. Hồ Chí Minh",
      techContact: {
        name: newCustTechName || "Đại diện Kỹ thuật",
        title: "IT Manager",
        phone: "0909 000 111",
        email: "tech@partner.vn",
      },
      accountingContact: {
        name: "Phòng Kế toán",
        title: "Kế toán thanh toán",
        phone: "0909 000 222",
        email: newCustAccEmail || "accounting@partner.vn",
      },
    })
    setNewCustomerModalOpen(false)
    setNewCustName("")
    setNewCustTax("")
  }

  // CHẾ ĐỘ DETAIL: Khi bấm vào 1 Khách hàng trong danh sách
  if (selectedCustomer) {
    const customerContracts = contracts.filter(
      (c) => c.customerId === selectedCustomer.id
    )

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-sm gap-1.5"
              onClick={() => setSelectedCustomerId(null)}
            >
              <IconArrowLeft className="size-4" />
              Danh bạ Khách hàng
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {selectedCustomer.companyName}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Mã KH: {selectedCustomer.code} • MST: {selectedCustomer.taxCode} • Địa chỉ:{" "}
                {selectedCustomer.address}
              </p>
            </div>
          </div>

          <Button
            onClick={() => setActiveScreen("create-contract")}
            className="h-9 px-4 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white gap-1.5 rounded-lg"
          >
            <IconPlus className="size-4" />
            Tạo Hợp đồng mới
          </Button>
        </div>

        {/* Thông tin 2 đầu mối Kỹ thuật & Kế toán */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
            <div className="text-xs font-medium text-slate-500">
              Đầu mối Kỹ thuật (Phối hợp UAT & Nghiệm thu Mốc)
            </div>
            <div className="text-base font-semibold text-slate-900">
              {selectedCustomer.techContact.name} —{" "}
              {selectedCustomer.techContact.title}
            </div>
            <div className="text-sm text-slate-600">
              SĐT: {selectedCustomer.techContact.phone} • Email:{" "}
              {selectedCustomer.techContact.email}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-1.5">
            <div className="text-xs font-medium text-slate-500">
              Đầu mối Kế toán (Tạm ứng, Tất toán & Nhận Hóa đơn VAT)
            </div>
            <div className="text-base font-semibold text-slate-900">
              {selectedCustomer.accountingContact.name} —{" "}
              {selectedCustomer.accountingContact.title}
            </div>
            <div className="text-sm text-slate-600">
              SĐT: {selectedCustomer.accountingContact.phone} • Email:{" "}
              {selectedCustomer.accountingContact.email}
            </div>
          </div>
        </div>

        {/* Bảng các Hợp đồng của Khách hàng */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 text-base font-semibold text-slate-900">
            Danh Sách Hợp Đồng Đã Ký ({customerContracts.length} Hợp đồng)
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[13px] font-medium text-slate-500">
                  <th className="py-3 pl-5 pr-3 font-medium">Mã HĐ</th>
                  <th className="py-3 px-3 font-medium">Tên Dự án</th>
                  <th className="py-3 px-3 font-medium">PM tổng</th>
                  <th className="py-3 px-3 font-medium">Giai đoạn</th>
                  <th className="py-3 px-3 text-right font-medium">
                    Thực tế tiêu / Mức giao PM
                  </th>
                  {roleView !== "PM" && (
                    <th className="py-3 px-3 text-right font-medium">
                      Giá trị HĐ
                    </th>
                  )}
                  <th className="py-3 pl-3 pr-5 text-right font-medium">
                    Mở dự án
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {customerContracts.map((contract) => {
                  const m = calculateContractMetrics(contract)
                  const phaseVi =
                    contract.phase === "PRE_PROJECT"
                      ? "Chuẩn bị"
                      : contract.phase === "IN_PROJECT"
                      ? "Đang chạy"
                      : contract.phase === "POST_PROJECT"
                      ? "Bàn giao"
                      : "Hoàn thành"
                  return (
                    <tr
                      key={contract.id}
                      onClick={() => openContractDetail(contract.id)}
                      className="hover:bg-slate-50/90 cursor-pointer whitespace-nowrap"
                    >
                      <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-slate-500">
                        {contract.contractCode}
                      </td>
                      <td className="py-3.5 px-2 font-semibold text-slate-900">
                        {contract.projectName}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700">
                        {contract.pmOwner}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {phaseVi}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right tabular-nums font-medium text-slate-900">
                        {m.effectiveRealMandays} / {m.effectiveTargetMandays} ngày
                      </td>
                      {roleView !== "PM" && (
                        <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                          {formatMoney(m.totalContractValue)}
                        </td>
                      )}
                      <td className="py-3.5 pl-3 pr-5 text-right">
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900">
                          Mở <IconArrowRight className="size-4" />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // CHẾ ĐỘ LIST: Danh bạ Khách hàng 14px chuẩn Productive.io
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Danh bạ Khách hàng
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Danh bạ Khách hàng Doanh nghiệp, Mã số thuế & Đầu mối Kỹ thuật (Nghiệm thu) / Kế toán (Hóa đơn VAT)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative w-72">
            <IconSearch className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên công ty, MST, người liên hệ..."
              className="pl-9 h-9 text-sm bg-white border-slate-200"
            />
          </div>

          <Button
            onClick={() => setNewCustomerModalOpen(true)}
            className="h-9 px-4 text-sm font-medium bg-slate-900 hover:bg-slate-800 text-white gap-1.5 rounded-lg"
          >
            <IconPlus className="size-4" />
            Thêm Khách hàng
          </Button>
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
                <th className="py-3 px-3 font-medium">
                  Đầu mối Kỹ thuật (UAT)
                </th>
                <th className="py-3 px-3 font-medium">
                  Đầu mối Kế toán (Nhận HĐ VAT)
                </th>
                <th className="py-3 px-3 text-center font-medium">
                  Số Dự án
                </th>
                {roleView !== "PM" && (
                  <th className="py-3 px-3 text-right font-medium">
                    Tổng quy mô HĐ
                  </th>
                )}
                <th className="py-3 pl-3 pr-5 text-right font-medium">
                  Hồ sơ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredCustomers.map((cust) => {
                const custContracts = contracts.filter(
                  (c) => c.customerId === cust.id
                )
                const totalVal = custContracts.reduce(
                  (acc, c) => acc + c.baseContractValue + c.approvedUpsellValue,
                  0
                )

                return (
                  <tr
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className="hover:bg-slate-50/90 cursor-pointer transition-colors group whitespace-nowrap"
                  >
                    <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-slate-500">
                      {cust.code}
                    </td>
                    <td className="py-3.5 px-3 font-semibold text-slate-900 group-hover:underline">
                      {cust.companyName}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-xs text-slate-600">
                      {cust.taxCode}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <PersonAvatar name={cust.techContact.name} />
                        <span className="font-medium text-slate-900">
                          {cust.techContact.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          ({cust.techContact.phone})
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="text-slate-800">
                        {cust.accountingContact.name}
                      </span>{" "}
                      <span className="text-xs text-slate-500">
                        • {cust.accountingContact.email}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        {custContracts.length} dự án
                      </span>
                    </td>
                    {roleView !== "PM" && (
                      <td className="py-3.5 px-3 text-right tabular-nums font-semibold text-slate-900">
                        {formatMoney(totalVal)}
                      </td>
                    )}
                    <td className="py-3.5 pl-3 pr-5 text-right">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 group-hover:text-slate-900">
                        Xem <IconArrowRight className="size-4" />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm Khách Hàng */}
      <Dialog
        open={newCustomerModalOpen}
        onOpenChange={setNewCustomerModalOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              Thêm Khách Hàng Mới
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs">Tên doanh nghiệp</Label>
              <Input
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                placeholder="VD: Công ty Cổ phần Đầu tư..."
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mã số thuế</Label>
              <Input
                value={newCustTax}
                onChange={(e) => setNewCustTax(e.target.value)}
                placeholder="031..."
                className="h-8 text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Đầu mối Kỹ thuật</Label>
              <Input
                value={newCustTechName}
                onChange={(e) => setNewCustTechName(e.target.value)}
                placeholder="Họ tên & SĐT"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email Kế toán nhận Hóa đơn VAT</Label>
              <Input
                value={newCustAccEmail}
                onChange={(e) => setNewCustAccEmail(e.target.value)}
                placeholder="accounting@company.vn"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewCustomerModalOpen(false)}
            >
              Hủy
            </Button>
            <Button
              size="sm"
              onClick={handleCreateCustomer}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Lưu Khách Hàng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
