"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export function toVietnameseTitleCase(str?: string): string {
  if (!str || typeof str !== "string") return "";
  return str
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(?:^|[\s\-\/\.,])\S/g, (char) => char.toUpperCase());
}

export interface VietnameseNameInputProps
  extends React.ComponentProps<typeof Input> {}

export const VietnameseNameInput = React.forwardRef<
  HTMLInputElement,
  VietnameseNameInputProps
>(({ onBlur, onChange, className, style, ...props }, ref) => {
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const formatted = toVietnameseTitleCase(e.target.value || "");
    if (onChange && formatted !== e.target.value) {
      e.target.value = formatted;
      onChange(e as any);
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <Input
      {...props}
      ref={ref}
      onChange={onChange}
      onBlur={handleBlur}
      style={{ lineHeight: '200px', ...style }}
      className={cn("pt-2 pb-1 leading-[200px]", className)}
    />
  )
})

VietnameseNameInput.displayName = "VietnameseNameInput"
