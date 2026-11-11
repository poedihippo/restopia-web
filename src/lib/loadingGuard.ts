/**
 * Global "still loading" guard for submit buttons.
 *
 * While any query that is on screen is doing its FIRST load (TanStack status
 * `pending` + fetchStatus `fetching`, at least one observer), every submit
 * control in the app is shown disabled and cannot fire: a click or an Enter
 * key submit is swallowed in the capture phase, before React's handlers. So a
 * form can never be saved while its options, the record being edited or the
 * page's data are still coming in.
 *
 * Background refetches of data already on screen do NOT block (that would grey
 * out every button on each refetch), and neither do mutations — the buttons
 * keep their own `disabled={isPending}` for that.
 *
 * What counts as a submit control (`isSubmitControl`):
 *   - button[type=submit], input[type=submit], anything marked data-submit
 *   - a button whose label is a primary action: Save, Create, Submit, Update,
 *     Confirm, Record, Pay, Settle, Simpan, Buat, … (see SUBMIT_LABEL)
 * Opt out with data-loading-exempt on the button or an ancestor.
 *
 * The state is exposed as `data-api-loading` on <html>, and each held control
 * gets `data-loading-held` (React leaves attributes it does not own alone);
 * globals.css styles them: the label is swapped for a spinner + "Please wait…"
 * and the control keeps its width (min-width frozen here), with a "Still
 * fetching data…" tooltip and aria-busy. Everything is restored once the data
 * is in. Installed once in src/pages/_app.tsx, next to the click
 * guard. DOM + QueryClient only, so the decisions stay testable.
 */

import type { Query, QueryClient } from '@tanstack/react-query'

export const LOADING_ATTRIBUTE = 'data-api-loading'
/** Set on each held control, so CSS can grey out label-detected buttons too. */
export const HELD_ATTRIBUTE = 'data-loading-held'
/** Tooltip on a held control (only when it has no title of its own). */
export const HELD_TITLE = 'Still fetching data, please wait…'

// What hold() changed on a control, so release() puts back exactly that.
const PREV_MIN_WIDTH = 'data-loading-prev-min-width'
const ADDED_TITLE = 'data-loading-title'

function hold(el: Element) {
  if (el.hasAttribute(HELD_ATTRIBUTE)) return
  if (el instanceof HTMLElement) {
    // Freeze the width so swapping the label for "Please wait…" never makes
    // the control (or the row it sits in) shrink and jump.
    const width = el.getBoundingClientRect().width
    if (width > 0) {
      el.setAttribute(PREV_MIN_WIDTH, el.style.minWidth)
      el.style.minWidth = `${Math.ceil(width)}px`
    }
  }
  if (!el.hasAttribute('title')) {
    el.setAttribute('title', HELD_TITLE)
    el.setAttribute(ADDED_TITLE, '')
  }
  el.setAttribute('aria-busy', 'true')
  el.setAttribute(HELD_ATTRIBUTE, '')
}

function release(el: Element) {
  if (el instanceof HTMLElement && el.hasAttribute(PREV_MIN_WIDTH)) {
    el.style.minWidth = el.getAttribute(PREV_MIN_WIDTH) ?? ''
    el.removeAttribute(PREV_MIN_WIDTH)
  }
  if (el.hasAttribute(ADDED_TITLE)) {
    el.removeAttribute('title')
    el.removeAttribute(ADDED_TITLE)
  }
  el.removeAttribute('aria-busy')
  el.removeAttribute(HELD_ATTRIBUTE)
}

export const SUBMIT_SELECTOR = [
  'button[type="submit"]',
  'input[type="submit"]',
  '[data-submit]',
].join(', ')

/**
 * Primary-action labels (first word). Navigation (+ Add, Edit, View, Back,
 * Cancel, Close, Export, Print, Filter, …) is deliberately not here.
 */
const SUBMIT_LABEL =
  /^(?:save|create|submit|update|confirm|record|post|apply|pay|settle|fulfill|fulfil|approve|reject|accept|import|generate|process|finalize|finalise|complete|checkout|charge|send|transfer|receive|issue|void|reverse|refund|return|simpan|buat|kirim|bayar|proses|terima|tolak|setujui|konfirmasi)\b/

function label(el: Element): string {
  const raw =
    el.getAttribute('aria-label') ??
    (el instanceof HTMLInputElement ? el.value : el.textContent) ??
    ''
  return raw.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** True when this element is a submit control the guard should hold. */
export function isSubmitControl(el: Element | null | undefined): boolean {
  if (!el || typeof el.closest !== 'function') return false
  if (el.closest('[data-loading-exempt]')) return false
  if (el.matches(SUBMIT_SELECTOR)) return true
  if (!el.matches('button, [role="button"]')) return false

  const text = label(el)
  // "+ Add …" opens a form; sidebar / nav items are navigation.
  if (!text || text.startsWith('+')) return false
  if (el.closest('nav, aside, [data-sidebar]')) return false

  return SUBMIT_LABEL.test(text)
}

/** A query on screen that has no data yet and is fetching it. */
export function isInitialLoad(query: Query): boolean {
  return (
    query.state.status === 'pending' &&
    query.state.fetchStatus === 'fetching' &&
    query.getObserversCount() > 0
  )
}

export function hasInitialLoad(client: QueryClient): boolean {
  return client.getQueryCache().getAll().some(isInitialLoad)
}

/**
 * Installs the guard. Returns the uninstall function. Client only (React
 * effect).
 */
export function installLoadingGuard(doc: Document, client: QueryClient): () => void {
  const root = doc.documentElement
  let loading = false

  const markHeld = () => {
    doc.querySelectorAll('button, [role="button"], input[type="submit"]').forEach((el) => {
      if (isSubmitControl(el)) hold(el)
    })
  }
  const clearHeld = () => {
    doc.querySelectorAll(`[${HELD_ATTRIBUTE}]`).forEach(release)
  }

  // While loading, controls rendered later (a sheet opening) are held too.
  const observer =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver(() => {
          if (loading) markHeld()
        })
      : null

  const sync = () => {
    const next = hasInitialLoad(client)
    if (next === loading) return
    loading = next
    if (loading) {
      root.setAttribute(LOADING_ATTRIBUTE, 'true')
      markHeld()
      observer?.observe(doc.body, { childList: true, subtree: true })
    } else {
      observer?.disconnect()
      root.removeAttribute(LOADING_ATTRIBUTE)
      clearHeld()
    }
  }

  // Cache events fire synchronously inside the fetch lifecycle; defer the DOM
  // write so a burst of events causes one attribute change.
  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      sync()
    })
  }

  const unsubscribe = client.getQueryCache().subscribe(schedule)
  sync()

  const onClick = (event: Event) => {
    if (!loading) return
    const target = event.target as Element | null
    if (!target || typeof target.closest !== 'function') return
    const control = target.closest('button, [role="button"], input[type="submit"]')
    if (!isSubmitControl(control)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  // Enter in a field submits the form without clicking a button.
  const onSubmit = (event: Event) => {
    if (!loading) return
    const form = event.target as Element | null
    if (form && typeof form.closest === 'function' && form.closest('[data-loading-exempt]')) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  doc.addEventListener('click', onClick, true)
  doc.addEventListener('submit', onSubmit, true)

  return () => {
    unsubscribe()
    observer?.disconnect()
    clearHeld()
    doc.removeEventListener('click', onClick, true)
    doc.removeEventListener('submit', onSubmit, true)
    root.removeAttribute(LOADING_ATTRIBUTE)
  }
}
