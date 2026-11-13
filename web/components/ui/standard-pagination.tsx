"use client"

import * as React from "react"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface StandardPaginationProps {
  page: number
  totalPages: number
  totalCount: number
  limit: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  /** Label đơn vị: "kết quả" | "bản ghi". Mặc định: "kết quả" */
  unit?: string
}

/**
 * Component pagination chuẩn dùng chung toàn dự án.
 * Hiển thị: text "Hiển thị x–y / z kết quả" + Prev / page numbers với ellipsis / Next
 */
export function StandardPagination({
  page,
  totalPages,
  totalCount,
  limit,
  onPageChange,
  isLoading = false,
  unit = "kết quả",
}: StandardPaginationProps) {
  const safeTotal = Math.max(0, totalCount)
  const safeTotalPages = Math.max(1, totalPages)

  const from = safeTotal > 0 ? (page - 1) * limit + 1 : 0
  const to = Math.min(page * limit, safeTotal)

  const renderPageNumbers = () => {
    if (safeTotalPages <= 1) {
      return (
        <PaginationItem>
          <PaginationLink isActive className="h-8 w-8 text-xs">
            1
          </PaginationLink>
        </PaginationItem>
      )
    }

    const pageNumbers: number[] = []
    const delta = 1

    for (let i = 1; i <= safeTotalPages; i++) {
      if (i === 1 || i === safeTotalPages || (i >= page - delta && i <= page + delta)) {
        pageNumbers.push(i)
      }
    }

    const elements: React.ReactNode[] = []
    let prevNum: number | null = null

    for (const num of pageNumbers) {
      if (prevNum !== null && num - prevNum > 1) {
        if (num - prevNum === 2) {
          // Chỉ thiếu 1 trang → hiện luôn thay vì ellipsis
          const midPage = prevNum + 1
          elements.push(
            <PaginationItem key={`page-${midPage}`}>
              <PaginationLink
                isActive={page === midPage}
                onClick={() => onPageChange(midPage)}
                className="h-8 w-8 text-xs cursor-pointer"
              >
                {midPage}
              </PaginationLink>
            </PaginationItem>
          )
        } else {
          elements.push(
            <PaginationItem key={`ellipsis-${num}`}>
              <PaginationEllipsis className="h-8 w-8 text-xs" />
            </PaginationItem>
          )
        }
      }
      elements.push(
        <PaginationItem key={`page-${num}`}>
          <PaginationLink
            isActive={page === num}
            onClick={() => onPageChange(num)}
            className="h-8 w-8 text-xs cursor-pointer"
          >
            {num}
          </PaginationLink>
        </PaginationItem>
      )
      prevNum = num
    }

    return elements
  }

  return (
    <div className="p-4 border-t flex items-center justify-between">
      <p className="text-xs text-muted-foreground hidden sm:block">
        {safeTotal === 0
          ? `Hiển thị 0 ${unit}`
          : `Hiển thị ${from}–${to} / ${safeTotal.toLocaleString("vi-VN")} ${unit}`}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(Math.max(1, page - 1))}
              className={`h-8 text-xs cursor-pointer ${
                page <= 1 || isLoading ? "opacity-50 pointer-events-none" : ""
              }`}
            />
          </PaginationItem>
          {renderPageNumbers()}
          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
              className={`h-8 text-xs cursor-pointer ${
                page >= safeTotalPages || isLoading ? "opacity-50 pointer-events-none" : ""
              }`}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
