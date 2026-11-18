/**
 * Global "click anywhere opens the calendar" for native date inputs.
 *
 * Browsers only open the picker from the small calendar icon; clicking the
 * text part just focuses a day/month/year segment. One document-level click
 * listener calls `showPicker()` on any enabled, editable date-like input so
 * the whole field behaves like a picker button (globals.css gives it the
 * matching pointer cursor). Keyboard entry is untouched.
 *
 * Opt-out: add `data-no-auto-picker` to the input (or an ancestor).
 * Used by src/pages/_app.tsx. DOM-only, no dependencies.
 */

const PICKER_TYPES = new Set(['date', 'datetime-local', 'month', 'week'])

export function installDatePickerClick(doc: Document): () => void {
  const onClick = (e: MouseEvent) => {
    const el = e.target
    if (!(el instanceof HTMLInputElement)) return
    if (!PICKER_TYPES.has(el.type) || el.disabled || el.readOnly) return
    if (el.closest('[data-no-auto-picker]')) return
    if (typeof el.showPicker !== 'function') return
    try {
      el.showPicker()
    } catch {
      // Already open, or not allowed in this context (e.g. cross-origin
      // iframe) — fall back to the browser's default behaviour.
    }
  }
  doc.addEventListener('click', onClick)
  return () => doc.removeEventListener('click', onClick)
}
