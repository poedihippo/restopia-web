/**
 * Date formatting utilities for the Dapur Cokelat web app.
 *
 * The backend returns dates in TWO different formats:
 *   1. Audit timestamps (created_at, updated_at):  "DD-MM-YYYY HH:mm WIB"
 *   2. ISO datetimes (expiry_date, etc.):           "YYYY-MM-DDTHH:mm:ssZ"
 *
 * JavaScript's built-in Date parser does NOT understand "WIB" as a timezone,
 * so we must parse format #1 manually before constructing a Date object.
 */

/**
 * Parses a date string from the backend into a JavaScript Date object.
 * Handles both "DD-MM-YYYY HH:mm WIB" and ISO 8601 formats.
 * Returns null if the string is empty, null, or unparseable.
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null

  // Detect format: "DD-MM-YYYY HH:mm ZZZ" (e.g. "09-06-2026 14:32 WIB")
  const ddmmyyyyMatch = value.match(
    /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})(?:\s+\w+)?$/
  )
  if (ddmmyyyyMatch) {
    const [, dd, mm, yyyy, HH, MM] = ddmmyyyyMatch
    // Reconstruct as ISO string (treat as WIB = UTC+7)
    const iso = `${yyyy}-${mm}-${dd}T${HH}:${MM}:00+07:00`
    const d = new Date(iso)
    return isNaN(d.getTime()) ? null : d
  }

  // Fallback: try native ISO 8601 parsing
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

// ─── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Formats a date from the API as a localized date string.
 * @example "09 Juni 2026"
 */
export function formatDate(
  value: string | null | undefined,
  locale = 'id-ID'
): string {
  const d = parseApiDate(value)
  if (!d) return '-'
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Formats a date from the API as a short date string.
 * @example "09/06/2026"
 */
export function formatDateShort(
  value: string | null | undefined,
  locale = 'id-ID'
): string {
  const d = parseApiDate(value)
  if (!d) return '-'
  return d.toLocaleDateString(locale)
}

/**
 * Formats a date from the API with both date and time.
 * @example "09 Jun 2026, 14:32"
 */
export function formatDateTime(
  value: string | null | undefined,
  locale = 'id-ID'
): string {
  const d = parseApiDate(value)
  if (!d) return '-'
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formats a date as a relative time string (e.g. "3 hari yang lalu").
 * Falls back to formatDate if the Intl.RelativeTimeFormat is not supported.
 */
export function formatRelativeDate(
  value: string | null | undefined,
  locale = 'id-ID'
): string {
  const d = parseApiDate(value)
  if (!d) return '-'

  const diff = Date.now() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    if (days > 30) return formatDate(value, locale)
    if (days > 0) return rtf.format(-days, 'day')
    if (hours > 0) return rtf.format(-hours, 'hour')
    if (minutes > 0) return rtf.format(-minutes, 'minute')
    return rtf.format(-seconds, 'second')
  } catch {
    return formatDate(value, locale)
  }
}

/**
 * Maps a backend date string to a YYYY-MM-DD string suitable for HTML <input type="date">.
 */
export function toInputDate(value: string | null | undefined): string {
  if (!value) return ''
  // If it's already YYYY-MM-DD
  if (value.match(/^\d{4}-\d{2}-\d{2}/)) return value.substring(0, 10)
  // If it's DD-MM-YYYY
  const dateOnlyMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (dateOnlyMatch) {
    const [, dd, mm, yyyy] = dateOnlyMatch
    return `${yyyy}-${mm}-${dd}`
  }
  return value.substring(0, 10)
}
