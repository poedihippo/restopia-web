import * as XLSX from 'xlsx'
import { getCanReadPrice } from '@/utils/price'

/**
 * Client-side Excel export for report views: builds the workbook from the
 * same rows the page renders, so the file always matches what was generated.
 */

export type ExcelCell = string | number | null | undefined
export type ExcelRow = ExcelCell[]

export interface ExcelSheet {
  name: string
  rows: ExcelRow[]
  /** Column widths in characters. */
  cols?: number[]
}

/** Money cell — masked the same way formatCurrency masks it on screen. */
export const money = (v: number | string | null | undefined): ExcelCell =>
  getCanReadPrice() ? Number(v ?? 0) : '***'

/** Standard report title block followed by an empty spacer row. */
export function reportHeader(lines: {
  title: string
  branch?: string
  period?: string
  extra?: string[]
}): ExcelRow[] {
  return [
    [lines.title],
    ['Dapur Cokelat Indonesia'],
    ...(lines.branch ? [[`Outlet : ${lines.branch}`]] : []),
    ...(lines.period ? [[`Period : ${lines.period}`]] : []),
    ...(lines.extra ?? []).map((l) => [l]),
    [`Printed : ${new Date().toLocaleString('id-ID')}`],
    [],
  ]
}

export function downloadExcel(filename: string, sheets: ExcelSheet[]) {
  const wb = XLSX.utils.book_new()
  sheets.forEach((sheet) => {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows)
    // Thousand separators on every numeric cell (decimals only when present).
    Object.keys(ws).forEach((addr) => {
      if (addr.startsWith('!')) return
      const cell = ws[addr] as XLSX.CellObject
      if (cell.t === 'n') {
        cell.z = Number.isInteger(cell.v) ? '#,##0' : '#,##0.00'
      }
    })
    if (sheet.cols) ws['!cols'] = sheet.cols.map((wch) => ({ wch }))
    // Sheet names: max 31 chars, no []:*?/\
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.replace(/[[\]:*?/\\]/g, '').slice(0, 31))
  })
  XLSX.writeFile(wb, filename)
}
