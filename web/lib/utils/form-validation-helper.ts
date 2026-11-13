import { toast } from "sonner"

const FIELD_LABELS: Record<string, string> = {
  notary_id: "Công chứng viên",
  drafter_id: "Chuyên viên soạn thảo",
  signing_address: "Địa chỉ ký ngoài trụ sở",
  value: "Giá trị hợp đồng",
  notary_fee: "Phí công chứng",
  "dossier_details.originalCopies": "Số bản chính",
  "property_details.certificateNumber": "Số seri GCN",
  "property_details.gcnBookNumber": "Số vào sổ cấp GCN",
  "property_details.gcnIssuedDate": "Ngày cấp GCN",
  "property_details.gcnIssuedBy": "Cơ quan cấp GCN",
  "property_details.landParcelNumber": "Thửa đất số",
  "property_details.mapSheetNumber": "Tờ bản đồ số",
  "property_details.totalArea": "Diện tích BĐS",
  "property_details.address": "Địa chỉ BĐS",
  "property_details.remuneration": "Thù lao ủy quyền",
  "property_details.bankName": "Tên Ngân hàng",
  "property_details.creditContractNumber": "Số HĐ tín dụng",
  "property_details.creditContractDate": "Ngày ký HĐ tín dụng",
  "property_details.relocationDecisionNumber": "Số Quyết định giao đất",
  "property_details.relocationDecisionDate": "Ngày Quyết định giao đất",
  "property_details.socialHousingContractNumber": "Số HĐMB với CĐT",
  "property_details.socialHousingContractDate": "Ngày ký HĐMB",
  "property_details.investorName": "Tên Chủ đầu tư",
  "property_details.deceasedName": "Tên người để lại di sản",
  "property_details.heirRelationship": "Quan hệ thừa kế",
  "property_details.deathDate": "Ngày mất",
  "property_details.deathCertificateNumber": "Số Giấy chứng tử",
  "certificateType": "Loại sổ / Giấy chứng nhận",
  "property_details.certificateType": "Loại sổ / Giấy chứng nhận",
}

export const getFriendlyErrorMessages = (errors: Record<string, any>): string[] => {
  const messages: string[] = []

  const traverse = (obj: any, path: string[] = []) => {
    if (!obj || typeof obj !== "object") return
    if (obj.message && typeof obj.message === "string") {
      const pathStr = path.join(".")
      let rawMsg = obj.message
      if (rawMsg.startsWith("Invalid input: expected number")) {
        rawMsg = "Dữ liệu phải là dạng số hợp lệ"
      } else if (rawMsg.startsWith("Invalid input")) {
        rawMsg = "Dữ liệu không hợp lệ"
      }

      let label = ""
      if (path[0] === "parties") {
        const side = path[1] === "partyA" ? "Bên A" : path[1] === "partyB" ? "Bên B" : "Đương sự"
        const idx = typeof path[2] === "number" || !isNaN(Number(path[2])) ? ` (Người ${Number(path[2]) + 1})` : ""
        label = `${side}${idx}: ${rawMsg}`
      } else if (FIELD_LABELS[pathStr] || FIELD_LABELS[path[0]]) {
        label = `${FIELD_LABELS[pathStr] || FIELD_LABELS[path[0]]}: ${rawMsg}`
      } else if (pathStr) {
        label = `${pathStr}: ${rawMsg}`
      } else {
        label = rawMsg
      }
      messages.push(label)
      return
    }
    for (const key of Object.keys(obj)) {
      traverse(obj[key], [...path, key])
    }
  }

  traverse(errors)
  return Array.from(new Set(messages))
}

export const scrollToFirstError = (errors: Record<string, any>) => {
  setTimeout(() => {
    const findFirstKey = (obj: any, prefix = ""): string | null => {
      for (const k of Object.keys(obj || {})) {
        const curr = prefix ? `${prefix}.${k}` : k
        if (obj[k]?.message) return curr
        if (typeof obj[k] === "object") {
          const nested = findFirstKey(obj[k], curr)
          if (nested) return nested
        }
      }
      return null
    }

    const firstFieldKey = findFirstKey(errors)
    let targetEl: HTMLElement | null = null

    if (firstFieldKey) {
      targetEl = document.querySelector(`[name="${firstFieldKey}"]`) as HTMLElement
    }
    if (!targetEl) {
      targetEl = document.querySelector('[aria-invalid="true"], .border-destructive, [data-invalid]') as HTMLElement
    }

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" })
      if (typeof targetEl.focus === "function") {
        targetEl.focus({ preventScroll: true })
      }
    }
  }, 100)
}

export const handleFormValidationErrors = (errors: any) => {
  console.warn("Form validation errors:", errors)
  const friendlyErrors = getFriendlyErrorMessages(errors)

  toast.error("Vui lòng điền đầy đủ thông tin", {
    description: friendlyErrors.length > 0
      ? friendlyErrors.slice(0, 3).join("; ") + (friendlyErrors.length > 3 ? ` (+${friendlyErrors.length - 3} lỗi khác)` : "")
      : "Có một số trường bắt buộc chưa được điền. Vui lòng kiểm tra lại form.",
    duration: 6000
  })

  scrollToFirstError(errors)
}
