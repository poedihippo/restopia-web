/**
 * Client-side PDF export for list/report views: builds a print document from the
 * same rows the page exports, opens it in a hidden iframe and calls the browser
 * print dialog (choose "Save as PDF"). No PDF library needed — same approach as
 * the AR Aging report.
 */

export type PdfCell = string | number | null | undefined

export interface PdfTable {
  title: string
  /** Lines under the title (outlet, period, filters…). */
  subtitle?: string[]
  headers: string[]
  rows: PdfCell[][]
  /** Optional totals row, same column count as headers. */
  footer?: PdfCell[]
  /** Column indexes to right-align (amounts). */
  rightAlign?: number[]
  landscape?: boolean
}

const escapeHtml = (v: PdfCell) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export function printTableAsPdf(t: PdfTable): boolean {
  const right = new Set(t.rightAlign ?? [])
  const cell = (v: PdfCell, i: number, tag: 'td' | 'th' = 'td') =>
    `<${tag}${right.has(i) ? ' class="r"' : ''}>${escapeHtml(v)}</${tag}>`

  const body = t.rows.length
    ? t.rows.map((r) => `<tr>${r.map((v, i) => cell(v, i)).join('')}</tr>`).join('')
    : `<tr><td colspan="${t.headers.length}" class="c">Tidak ada data</td></tr>`

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(t.title)}</title>
    <style>
      @page { size: A4 ${t.landscape === false ? 'portrait' : 'landscape'}; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
      h1 { font-size: 16px; margin: 0 0 2px; }
      .muted { color: #555; margin: 0 0 2px; }
      .meta { margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
      th { text-align: left; border-bottom: 2px solid #333; }
      .r { text-align: right; white-space: nowrap; }
      .c { text-align: center; }
      tfoot td { font-weight: bold; border-top: 2px solid #333; }
    </style></head><body>
    <h1>${escapeHtml(t.title)}</h1>
    <div class="meta">
      <p class="muted">Dapur Cokelat Indonesia</p>
      ${(t.subtitle ?? []).map((l) => `<p class="muted">${escapeHtml(l)}</p>`).join('')}
      <p class="muted">Printed: ${escapeHtml(new Date().toLocaleString('id-ID'))}</p>
    </div>
    <table>
      <thead><tr>${t.headers.map((h, i) => cell(h, i, 'th')).join('')}</tr></thead>
      <tbody>${body}</tbody>
      ${t.footer ? `<tfoot><tr>${t.footer.map((v, i) => cell(v, i)).join('')}</tr></tfoot>` : ''}
    </table>
  </body></html>`

  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return false
  }
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 1000)
  }, 250)
  return true
}
