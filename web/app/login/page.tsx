"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { IconLoader2, IconLock, IconUser } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { API_URL } from "@/lib/api/axios-instance"

const loginSchema = z.object({
  username: z.string().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự"),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    }
  })

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        toast.error("Đăng nhập thất bại", {
          description: result.errors?.[0]?.message || result.message || "Tên đăng nhập hoặc mật khẩu không chính xác."
        })
        return
      }
      toast.success("Đăng nhập thành công!", {
        description: "Đang chuyển hướng vào hệ thống..."
      })
      window.location.href = "/"
    } catch (error: any) {
      toast.error("Lỗi kết nối", {
        description: "Không thể kết nối đến máy chủ xác thực."
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex font-sans">

      {/* ===== LEFT PANEL — Branding ===== */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden flex-col justify-between bg-primary text-primary-foreground">
        {/* Wave */}
        <svg className="absolute bottom-0 left-0 w-full h-[45%] opacity-[0.06] pointer-events-none" viewBox="0 0 800 400" fill="none" preserveAspectRatio="none">
          <path d="M0 280C150 180 350 380 500 280C650 180 750 240 800 220V400H0Z" fill="white"/>
          <path d="M0 320C200 220 300 400 500 300C700 200 750 280 800 260V400H0Z" fill="white"/>
        </svg>

        {/* Logo */}
        <div className="relative z-10 p-10">
          <div className="flex items-center h-14">
            <img src="/logo.svg" alt="VPCC Logo" className="h-14 w-auto object-contain" />
          </div>
        </div>

        {/* Heading */}
        <div className="relative z-10 px-10 pb-8 flex-1 flex flex-col justify-center">
          <h1 className="text-white text-4xl leading-[1.2] font-bold tracking-tight mb-4">
            Hệ thống Quản trị<br />
            <span className="text-blue-200">Tổng thể Doanh nghiệp</span>
          </h1>
          <p className="text-blue-100/85 text-base leading-relaxed max-w-md mb-6">
            Quản trị hợp đồng, sổ cái ngày công (Manday Credit) và dòng tiền dự án nội bộ trên một nền tảng duy nhất.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Quản trị hợp đồng & Manday', 'Phân quyền RBAC', 'Đối soát công nợ & VAT'].map(f => (
              <span
                key={f}
                className="text-xs px-3 py-1.5 rounded-md font-medium bg-white/10 text-blue-50 border border-white/15"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <div className="relative z-10 px-10 pb-8">
          <p className="text-blue-100/75 text-sm">© 2026 ERP-AM — Hệ thống Quản trị Doanh nghiệp</p>
        </div>
      </div>

      {/* ===== RIGHT PANEL — Form ===== */}
      <div className="w-full lg:w-[52%] flex items-center justify-center bg-white p-8 sm:p-12">
        <div className="w-full max-w-[420px] flex flex-col">

          {/* Mobile Logo */}
          <div className="flex items-center lg:hidden mb-10 rounded-xl justify-center py-5 bg-primary">
            <img src="/logo.svg" alt="VPCC Logo" className="h-10 w-auto object-contain" />
          </div>

          {/* Heading */}
          <div className="flex flex-col gap-1.5 mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-primary">
              Đăng nhập
            </h2>
            <p className="text-slate-600 text-sm">Nhập tài khoản để truy cập hệ thống nội bộ</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-semibold text-slate-800">Tên đăng nhập</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <IconUser className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                        <Input
                          placeholder="VD: admin"
                          className="h-11 pl-10 bg-white border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 transition-all"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="text-sm font-semibold text-slate-800">Mật khẩu</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <IconLock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                        <Input
                          type="password"
                          placeholder="Nhập mật khẩu"
                          className="h-11 pl-10 bg-white border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-500 transition-all"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 mt-2 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground transition-colors"
                disabled={isLoading}
              >
                {isLoading ? (
                  <><IconLoader2 className="mr-2 size-4 animate-spin" /> Đang xác thực...</>
                ) : (
                  "Đăng nhập"
                )}
              </Button>

            </form>
          </Form>

          <p className="text-center text-xs text-slate-500 mt-8">
            Hệ thống chỉ dành cho nhân sự được cấp quyền
          </p>
        </div>
      </div>
    </div>
  )
}
