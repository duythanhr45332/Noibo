import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { IconError404 } from '@tabler/icons-react'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center bg-slate-50">
      <div className="rounded-full bg-white p-6 mb-8 shadow-sm border border-slate-100">
        <IconError404 className="w-20 h-20 text-slate-400" stroke={1.5} />
      </div>
      <h1 className="text-6xl font-bold text-slate-900 mb-4 tracking-tight">404</h1>
      <h2 className="text-2xl font-semibold text-slate-800 mb-4">Không tìm thấy trang</h2>
      <p className="text-slate-500 mb-8 max-w-md">
        Xin lỗi, trang bạn đang tìm kiếm không tồn tại, đã bị xóa hoặc tạm thời không thể truy cập.
      </p>
      <Link href="/">
        <Button size="lg" className="rounded-full px-8 font-medium">
          Về trang chủ
        </Button>
      </Link>
    </div>
  )
}
