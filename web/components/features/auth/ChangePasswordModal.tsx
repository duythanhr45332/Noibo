import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { IconLoader2 } from "@tabler/icons-react"
import { putApiV1AuthChangePassword } from "@/lib/api/generated/authentication/authentication"

const formSchema = z.object({
  old_password: z.string().min(1, "Vui lòng nhập mật khẩu cũ"),
  new_password: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
  confirm_password: z.string().min(1, "Vui lòng xác nhận mật khẩu mới"),
}).refine((data) => data.new_password === data.confirm_password, {
  message: "Xác nhận mật khẩu không khớp",
  path: ["confirm_password"],
})

type FormValues = z.infer<typeof formSchema>

interface ChangePasswordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangePasswordModal({ open, onOpenChange }: ChangePasswordModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      old_password: "",
      new_password: "",
      confirm_password: "",
    }
  })

  React.useEffect(() => {
    if (open) {
      reset()
    }
  }, [open, reset])

  const onSubmit = async (values: FormValues) => {
    try {
      const response = await putApiV1AuthChangePassword({
        old_password: values.old_password,
        new_password: values.new_password
      })
      if (response?.success) {
        toast.success("Đổi mật khẩu thành công!")
        onOpenChange(false)
      }
    } catch (error: any) {
      const msg = error.response?.data?.errors?.[0]?.message || "Đổi mật khẩu thất bại"
      toast.error(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full">
        <DialogHeader>
          <DialogTitle>Đổi Mật Khẩu</DialogTitle>
          <DialogDescription>
            Đảm bảo mật khẩu mới của bạn có độ dài từ 6 ký tự trở lên.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="old_password" className="text-[11px] font-bold text-muted-foreground uppercase">Mật khẩu hiện tại <span className="text-destructive">*</span></Label>
            <Input 
              id="old_password" 
              type="password"
              placeholder="Nhập mật khẩu hiện tại" 
              {...register("old_password")} 
              className={errors.old_password ? "border-destructive" : ""}
            />
            {errors.old_password && <p className="text-xs text-destructive font-medium">{errors.old_password.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="new_password" className="text-[11px] font-bold text-muted-foreground uppercase">Mật khẩu mới <span className="text-destructive">*</span></Label>
            <Input 
              id="new_password" 
              type="password"
              placeholder="Nhập mật khẩu mới (Tối thiểu 6 ký tự)" 
              {...register("new_password")} 
              className={errors.new_password ? "border-destructive" : ""}
            />
            {errors.new_password && <p className="text-xs text-destructive font-medium">{errors.new_password.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm_password" className="text-[11px] font-bold text-muted-foreground uppercase">Xác nhận mật khẩu mới <span className="text-destructive">*</span></Label>
            <Input 
              id="confirm_password" 
              type="password"
              placeholder="Nhập lại mật khẩu mới" 
              {...register("confirm_password")} 
              className={errors.confirm_password ? "border-destructive" : ""}
            />
            {errors.confirm_password && <p className="text-xs text-destructive font-medium">{errors.confirm_password.message}</p>}
          </div>

          <DialogFooter className="pt-4 mt-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Hủy
            </Button>
            <Button type="submit" className="w-full sm:w-auto bg-[#062a6a] hover:bg-[#062a6a]/90 text-white" disabled={isSubmitting}>
              {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
              Đổi mật khẩu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
