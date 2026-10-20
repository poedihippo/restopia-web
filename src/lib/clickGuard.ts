/**
 * Global double-click guard.
 *
 * One document-level, CAPTURE-phase listener blocks a second click on the same
 * button within `lockMs`, so a user can never double-submit (create 2 records,
 * run a settlement twice, add 2 rows, …). Because it runs in the capture phase
 * on `document`, `stopImmediatePropagation()` also prevents React's own
 * `onClick` from ever firing — this covers every button in the app, including
 * ones whose handler does NOT wire `disabled={isPending}`.
 *
 * Repeat-friendly controls (qty steppers, prev/next pagination, chevron
 * toggles) are exempt so they stay snappy — see `isRepeatControl`.
 *
 * Opt-out / opt-in:
 *   data-fast-click   → never lock this button (or any button inside it)
 *   (nothing else needed: plain buttons are locked by default)
 *
 * Used by src/pages/_app.tsx. Keep this module dependency-free (DOM-only) so
 * the decision logic stays testable.
 */

export const DEFAULT_LOCK_MS = 350

/** Anything clickable that usually wraps a React onClick. */
export const CLICK_GUARD_SELECTOR = [
  'button',
  '[role="button"]',
  'input[type="submit"]',
  'input[type="image"]',
].join(', ')

/** Labels that identify a "tap repeatedly" control: +, −, 12, prev, next, … */
const REPEAT_LABEL = /^(?:\+|-|−|–|=|\d+(?:[.,]\d+)?)$/
const REPEAT_WORD =
  /^(?:prev|previous|next|back|forward|increment|decrement|increase|decrease|plus|minus|tambah|kurang|kurangi|lebih)$/

interface TimestampStore {
  get(key: object): number | undefined
  set(key: object, value: number): void
}

/**
 * Should this click pass through? Pure timing decision (element-keyed), so it
 * can be unit tested with any store.
 *   - first click on a key  → allowed, timestamp recorded
 *   - click within lockMs   → blocked (duplicate)
 *   - click after lockMs    → allowed, timestamp refreshed
 */
export function gateAllows(
  key: object,
  now: number,
  store: TimestampStore,
  lockMs: number = DEFAULT_LOCK_MS,
): boolean {
  const previous = store.get(key)
  if (previous !== undefined && now - previous < lockMs) return false
  store.set(key, now)
  return true
}

/**
 * True for controls where fast repeats are legitimate:
 *   - anything marked `data-fast-click` (self or ancestor)
 *   - buttons whose accessible text is +/−/a number (steppers, page sizes)
 *   - buttons labelled prev/next/increase/…
 *   - buttons containing a chevron icon (pagination + fold/unfold arrows)
 */
export function isRepeatControl(el: Element | null | undefined): boolean {
  if (!el) return false
  if (typeof el.closest === 'function' && el.closest('[data-fast-click]')) return true

  const label = String(
    el.getAttribute?.('aria-label') ??
      el.getAttribute?.('title') ??
      el.textContent ??
      '',
  )
    .trim()
    .toLowerCase()

  if (REPEAT_LABEL.test(label)) return true
  if (REPEAT_WORD.test(label)) return true

  if (typeof el.querySelector === 'function') {
    if (
      el.querySelector(
        'svg.lucide-chevron-left, svg.lucide-chevron-right, svg.lucide-chevron-up, svg.lucide-chevron-down',
      )
    ) {
      return true
    }
  }
  return false
}

export type ClickGuardOptions = {
  /** Lock window in ms. Default DEFAULT_LOCK_MS (350). */
  lockMs?: number
  /** Override the clickable-element selector. */
  selector?: string
}

/**
 * Installs the guard on a document. Returns the uninstall function.
 * Safe to call in a React effect (client only).
 */
export function installClickGuard(
  doc: Document,
  options: ClickGuardOptions = {},
): () => void {
  const lockMs = options.lockMs ?? DEFAULT_LOCK_MS
  const selector = options.selector ?? CLICK_GUARD_SELECTOR
  const timestamps: WeakMap<object, number> = new WeakMap()

  const listener = (event: Event) => {
    const target = event.target as Element | null
    if (!target || typeof (target as Element).closest !== 'function') return

    const clickable = target.closest(selector) as Element | null
    if (!clickable) return
    if (isRepeatControl(clickable)) return

    if (!gateAllows(clickable, Date.now(), timestamps, lockMs)) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }

  doc.addEventListener('click', listener, true)
  return () => doc.removeEventListener('click', listener, true)
}
