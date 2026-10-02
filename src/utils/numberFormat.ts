/**
 * Indonesian number format (id-ID):
 * - Thousand separator: period (.)
 * - Decimal separator: comma (,)
 *
 * UI/input: always id-ID (e.g. 100.000,92)
 * Backend/API: standard JS number with period decimal (e.g. 100000.92)
 */

export function parseNumberId(
  input: string | number | null | undefined,
): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : 0
  }
  if (input === null || input === undefined || input === '') return 0

  let s = String(input).trim().replace(/\s/g, '').replace(/ /g, '')
  if (!s) return 0

  // Allow leading minus
  let sign = 1
  if (s.startsWith('-')) {
    sign = -1
    s = s.slice(1)
  }

  if (s.includes(',')) {
    // id-ID typed: strip thousand periods, comma → period decimal
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Pure thousand-separated integer: 1.000.000
    s = s.replace(/\./g, '')
  }
  // else: backend style 100000.92 or plain integer — leave as-is

  const n = Number(s)
  return Number.isFinite(n) ? sign * n : 0
}

export function formatNumberId(
  value: string | number | null | undefined,
  decimals = 2,
  options?: { pad?: boolean },
): string {
  const pad = options?.pad ?? true
  const n = typeof value === 'string' ? parseNumberId(value) : Number(value ?? 0)
  if (!Number.isFinite(n)) {
    if (!pad) return '0'
    return decimals > 0 ? `0,${'0'.repeat(decimals)}` : '0'
  }
  return n.toLocaleString('id-ID', {
    minimumFractionDigits: pad ? decimals : 0,
    maximumFractionDigits: decimals,
  })
}

/**
 * Sanitize keystrokes for Indonesian number input.
 * - Digits and a single comma only
 * - Period rejected (not allowed in input)
 * - Max decimal digits enforced
 */
export function sanitizeNumberInput(raw: string, maxDecimals = 2): string {
  let s = raw.replace(/[^\d,]/g, '')
  const firstComma = s.indexOf(',')
  if (firstComma === -1) return s
  const intPart = s.slice(0, firstComma)
  let decPart = s.slice(firstComma + 1).replace(/,/g, '')
  if (maxDecimals <= 0) return intPart
  if (decPart.length > maxDecimals) decPart = decPart.slice(0, maxDecimals)
  if (!intPart && !decPart) return ''
  if (!intPart && decPart) return `,${decPart}`
  return `${intPart},${decPart}`
}
