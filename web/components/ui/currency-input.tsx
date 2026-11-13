"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface CurrencyInputProps {
  value: number | string | undefined | null
  onChange: (value: number) => void
  onClear?: () => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
}

export function formatNumberWithDots(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === "") return ""
  const numStr = val.toString().replace(/\D/g, "")
  if (!numStr) return ""
  return new Intl.NumberFormat("vi-VN").format(Number(numStr))
}

export function parseFormattedNumber(valStr: string): number {
  const cleanStr = valStr.replace(/\D/g, "")
  return cleanStr ? Number(cleanStr) : 0
}

export function CurrencyInput({
  value,
  onChange,
  onClear,
  placeholder = "0",
  className,
  disabled = false,
  id
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(formatNumberWithDots(value))

  useEffect(() => {
    setDisplayValue(formatNumberWithDots(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawStr = e.target.value
    const cleanStr = rawStr.replace(/\D/g, "")
    if (!cleanStr) {
      setDisplayValue("")
      onChange(0)
      onClear?.()
      return
    }
    const parsedNum = Number(cleanStr)
    setDisplayValue(formatNumberWithDots(parsedNum))
    onChange(parsedNum)
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("font-medium", className)}
      />
    </div>
  )
}
