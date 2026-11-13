/**
 * Export data to Excel/CSV format with UTF-8 BOM so Microsoft Excel opens directly without font corruption.
 */

export interface ExportColumn {
  header: string
  key: string
  formatter?: (val: any, row: any) => string | number
}

export function exportToCsv(
  data: any[],
  columns: ExportColumn[],
  filename: string,
  title?: string
) {
  if (!data || data.length === 0) {
    alert("Không có dữ liệu để xuất file!")
    return
  }

  const lines: string[] = []

  // Title line if provided
  if (title) {
    lines.push(`"${title.replace(/"/g, '""')}"`)
    lines.push(`"Ngày xuất: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}"`)
    lines.push("") // Empty row
  }

  // Header row
  const headers = columns.map(c => `"${c.header.replace(/"/g, '""')}"`)
  lines.push(headers.join(","))

  // Data rows
  data.forEach((row, idx) => {
    const rowValues = columns.map(col => {
      let rawVal = row[col.key]
      if (col.key === "stt") {
        rawVal = idx + 1
      } else if (col.formatter) {
        rawVal = col.formatter(rawVal, row)
      }
      
      const strVal = rawVal === null || rawVal === undefined ? "" : String(rawVal)
      // Escape quotes
      return `"${strVal.replace(/"/g, '""')}"`
    })
    lines.push(rowValues.join(","))
  })

  // UTF-8 BOM prefix
  const csvContent = "\uFEFF" + lines.join("\r\n")

  // Create blob & trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
