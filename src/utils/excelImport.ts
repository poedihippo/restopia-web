/**
 * Helpers shared by the Excel/CSV import screens (Opening Balances, Bank
 * Reconciliation statement upload). The workbook itself is read with the
 * `xlsx` lib by the caller; these work on the cell values it returns.
 */

/** Excel cells arrive as numbers, or as text in either 1.234.567,89 or 1,234,567.89 form. */
export function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '') return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  let s = String(raw).trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, '')
  if (!s || s === '-') return 0
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal one.
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma > -1) {
    // 1,5 → decimal; 1,000,000 → thousands.
    s = /,\d{3}$/.test(s) && s.split(',').length > 2 ? s.replace(/,/g, '') : /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '')
  } else if (lastDot > -1 && (s.split('.').length > 2 || /\.\d{3}$/.test(s))) {
    s = s.replace(/\./g, '')
  }
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** "Debet (uang keluar)" → "debetuangkeluar": lower-case letters only. */
export const normalizeHeader = (h: unknown) => String(h ?? '').trim().toLowerCase().replace(/[^a-z]/g, '')

/** True when a cell holds nothing (empty string, whitespace, null). */
export const isBlankCell = (v: unknown) => v === null || v === undefined || String(v).trim() === ''

/**
 * Index of the first grid row that has a cell matching one of `aliases`
 * (compared after normalizeHeader), or -1.
 */
export function findHeaderRow(grid: unknown[][], aliases: string[]): number {
  const wanted = aliases.map(normalizeHeader)
  return grid.findIndex((r) => r.some((c) => wanted.includes(normalizeHeader(c))))
}

/**
 * Column lookup for a header row: `col('debit', 'debet')` returns the index of
 * the first header equal to any alias, or -1. With `prefix`, a header that
 * merely starts with an alias also matches ("Debet (uang keluar)" ← "debet"),
 * after exact matches were tried.
 */
export function columnFinder(headerRow: unknown[], opts: { prefix?: boolean } = {}) {
  const head = headerRow.map(normalizeHeader)
  return (...aliases: string[]): number => {
    const wanted = aliases.map(normalizeHeader).filter(Boolean)
    const exact = head.findIndex((h) => wanted.includes(h))
    if (exact > -1 || !opts.prefix) return exact
    return head.findIndex((h) => !!h && wanted.some((a) => h.startsWith(a)))
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/**
 * A date cell → 'YYYY-MM-DD', or null when it can't be read.
 * Accepts Excel serial numbers, Date objects, dd/mm/yyyy (also with - or .,
 * 2-digit years, optional time) and yyyy-mm-dd.
 */
export function parseDateCell(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null
    return `${raw.getFullYear()}-${pad2(raw.getMonth() + 1)}-${pad2(raw.getDate())}`
  }
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 1 || raw > 2958465) return null
    // Excel day 0 = 1899-12-30 (accounts for the 1900 leap-year bug).
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 86_400_000)
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
  }
  const s = String(raw).trim().split(/[\sT]/)[0]
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s)
  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s)
  if (m) return validYmd(Number(m[3]), Number(m[2]), Number(m[1]))
  if (/^\d+(\.\d+)?$/.test(s)) return parseDateCell(Number(s))
  return null
}
