/**
 * Second horizontal scrollbar for wide tables, drawn right under the header
 * row, so users don't have to scroll to the bottom of a long table to reach
 * the native scrollbar.
 *
 * ui-v2.css makes every `main div:has(> table)` scroll sideways. For each such
 * container that overflows, a thin scroller (`.v2-top-scroll`) is inserted
 * just before it and shifted down onto the header's bottom edge. It mirrors
 * the container's scroll position both ways. Header cells get extra bottom
 * padding (`table.v2-top-scroll-on`) so the bar never covers a label.
 *
 * Installed once from GlobalLayout; returns a cleanup function.
 */

type Entry = {
  container: HTMLElement
  table: HTMLTableElement
  bar: HTMLDivElement
  spacer: HTMLDivElement
  ro: ResizeObserver
  onBar: () => void
  onContainer: () => void
  dx: number
  dy: number
}

const BLOCK_PARENTS = new Set(['block', 'flow-root', 'list-item'])

function canHostBar(container: HTMLElement): boolean {
  const parent = container.parentElement
  if (!parent) return false
  const cs = getComputedStyle(parent)
  if (BLOCK_PARENTS.has(cs.display)) return true
  // A column flex parent stacks the bar above the container like a block does.
  return (cs.display === 'flex' || cs.display === 'inline-flex') && cs.flexDirection.startsWith('column')
}

export function installTableTopScrollbars(root: HTMLElement): () => void {
  const entries = new Map<HTMLTableElement, Entry>()
  let frame = 0

  const layout = (e: Entry) => {
    const { container, table, bar, spacer } = e
    const thead = table.tHead
    const overflows = container.scrollWidth > container.clientWidth + 1
    if (!thead || !overflows || !container.isConnected) {
      bar.style.display = 'none'
      bar.style.marginBottom = ''
      table.classList.remove('v2-top-scroll-on')
      return
    }
    bar.style.display = 'block'
    table.classList.add('v2-top-scroll-on')
    spacer.style.width = `${container.scrollWidth}px`
    bar.style.width = `${container.clientWidth}px`
    const h = bar.offsetHeight
    table.style.setProperty('--v2-top-scroll-h', `${h}px`)
    bar.style.marginBottom = `${-h}px`
    // Line the bar up with the container's padding box, just above the
    // header's bottom border. Measure against the bar's untransformed spot.
    const b = bar.getBoundingClientRect()
    const c = container.getBoundingClientRect()
    const head = thead.getBoundingClientRect()
    const baseLeft = b.left - e.dx
    const baseTop = b.top - e.dy
    e.dx = Math.round(c.left + container.clientLeft - baseLeft)
    e.dy = Math.round(head.bottom - h - 4 - baseTop)
    bar.style.transform = `translate(${e.dx}px, ${e.dy}px)`
    bar.scrollLeft = container.scrollLeft
  }

  const attach = (table: HTMLTableElement) => {
    const container = table.parentElement
    if (!(container instanceof HTMLDivElement) || !table.tHead) return
    if (table.closest('[data-top-scroll="off"]')) return
    if (!canHostBar(container)) return

    const bar = document.createElement('div')
    bar.className = 'v2-top-scroll'
    bar.setAttribute('aria-hidden', 'true')
    bar.dataset.fastClick = ''
    const spacer = document.createElement('div')
    spacer.className = 'v2-top-scroll-spacer'
    bar.appendChild(spacer)
    container.parentElement!.insertBefore(bar, container)

    // Only write when the two differ, so the mirrored scroll event is a no-op.
    const onBar = () => {
      if (Math.abs(container.scrollLeft - bar.scrollLeft) > 1) container.scrollLeft = bar.scrollLeft
    }
    const onContainer = () => {
      if (Math.abs(bar.scrollLeft - container.scrollLeft) > 1) bar.scrollLeft = container.scrollLeft
    }
    bar.addEventListener('scroll', onBar, { passive: true })
    container.addEventListener('scroll', onContainer, { passive: true })

    const entry: Entry = { container, table, bar, spacer, ro: null as unknown as ResizeObserver, onBar, onContainer, dx: 0, dy: 0 }
    entry.ro = new ResizeObserver(() => layout(entry))
    entry.ro.observe(container)
    entry.ro.observe(table)
    if (table.tHead) entry.ro.observe(table.tHead)
    entries.set(table, entry)
    layout(entry)
  }

  const detach = (e: Entry) => {
    e.ro.disconnect()
    e.bar.removeEventListener('scroll', e.onBar)
    e.container.removeEventListener('scroll', e.onContainer)
    e.bar.remove()
    e.table.classList.remove('v2-top-scroll-on')
    e.table.style.removeProperty('--v2-top-scroll-h')
    entries.delete(e.table)
  }

  const scan = () => {
    frame = 0
    for (const e of Array.from(entries.values())) {
      // Table removed or re-parented by React: drop the bar.
      if (!e.table.isConnected || e.table.parentElement !== e.container || !e.container.isConnected) detach(e)
    }
    root.querySelectorAll<HTMLTableElement>('table').forEach((t) => {
      if (!entries.has(t)) attach(t)
    })
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(scan)
  }

  const mo = new MutationObserver((records) => {
    // Ignore our own bar insertions/removals.
    const ours = records.every((r) =>
      [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)].every(
        (n) => n instanceof HTMLElement && n.classList.contains('v2-top-scroll'),
      ),
    )
    if (!ours) schedule()
  })
  mo.observe(root, { childList: true, subtree: true })
  schedule()

  return () => {
    mo.disconnect()
    if (frame) cancelAnimationFrame(frame)
    for (const e of Array.from(entries.values())) detach(e)
  }
}
