import { getProductUomName } from '@/utils/productUomName'
import { deductionTypeLabel } from '@/utils/deductionType'

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const fmtQty = (n: unknown) => Number(n ?? 0).toLocaleString('id-ID', { maximumFractionDigits: 3 })

/**
 * Prints one recipe as an A4 kitchen sheet: big readable ingredient list with
 * tick boxes, a notes area and sign-off lines. Uses a hidden iframe so the
 * app page itself is untouched.
 */
export function printRecipe(recipe: any) {
  const name = getProductUomName(recipe.product_uom, recipe.product_uom?.product?.name) || '—'
  const sku = recipe.product_uom?.code ?? ''
  const uom = (recipe.product_uom?.uom?.code ?? recipe.product_uom?.uom?.name ?? '').toLowerCase()
  const materials: any[] = recipe.recipe_materials ?? []

  const rows = materials
    .map(
      (m, i) => `
      <tr>
        <td class="num">${i + 1}</td>
        <td class="tick"><span></span></td>
        <td>
          <div class="ing">${esc(getProductUomName(m.product_uom, m.product_uom?.product?.name) || '—')}</div>
          ${m.product_uom?.code ? `<div class="sku">SKU ${esc(m.product_uom.code)}</div>` : ''}
        </td>
        <td class="qty">${esc(fmtQty(m.qty))} <small>${esc((m.product_uom?.uom?.code ?? '').toLowerCase())}</small></td>
        <td class="ded">${esc(deductionTypeLabel(m.deduction_type))}</td>
      </tr>`,
    )
    .join('')

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(name)} — Recipe</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Instrument Sans', -apple-system, 'Segoe UI', Arial, sans-serif; color: #2a1a13; font-size: 13px; }
  .brand { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 3px solid #4A2E21; padding-bottom: 8px; }
  .brand b { letter-spacing: 2px; font-size: 12px; }
  .brand span { font-size: 11px; color: #7a6a60; }
  .eyebrow { margin-top: 18px; font-size: 11px; letter-spacing: 1.6px; text-transform: uppercase; color: #9a6b38; font-weight: 600; }
  h1 { font-family: 'Playfair Display', Georgia, 'Times New Roman', serif; font-weight: 500; font-size: 30px; margin: 4px 0 6px; line-height: 1.15; }
  .meta { display: flex; gap: 28px; font-size: 13px; color: #5c4a40; margin-bottom: 18px; }
  .meta strong { color: #2a1a13; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10.5px; letter-spacing: 1.2px; text-transform: uppercase; color: #7a6a60; border-bottom: 1.5px solid #2a1a13; padding: 6px 8px; }
  td { padding: 9px 8px; border-bottom: 1px dotted #b9aaa0; vertical-align: middle; }
  tr { page-break-inside: avoid; }
  .num { width: 28px; color: #9a8a80; font-variant-numeric: tabular-nums; }
  .tick { width: 30px; }
  .tick span { display: inline-block; width: 16px; height: 16px; border: 1.5px solid #4A2E21; border-radius: 3px; }
  .ing { font-size: 15px; font-weight: 600; }
  .sku { font-size: 10.5px; color: #8a7a70; margin-top: 2px; }
  .qty { text-align: right; font-size: 17px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .qty small { font-size: 12px; font-weight: 400; color: #5c4a40; }
  th.r { text-align: right; }
  .ded { width: 80px; font-size: 11px; color: #5c4a40; text-align: right; }
  .notes { margin-top: 22px; border: 1px solid #c9bbb0; border-radius: 6px; padding: 10px 12px; height: 120px;
    background-image: repeating-linear-gradient(transparent 0 27px, #e4dad2 27px 28px); background-position: 0 30px; }
  .notes b { font-size: 10.5px; letter-spacing: 1.2px; text-transform: uppercase; color: #7a6a60; }
  .sign { display: flex; gap: 24px; margin-top: 28px; }
  .sign div { flex: 1; border-top: 1px solid #2a1a13; padding-top: 6px; font-size: 11px; color: #5c4a40; }
  .empty { padding: 24px 8px; font-style: italic; color: #8a7a70; }
</style></head>
<body>
  <div class="brand"><b>DAPUR COKELAT</b><span>Printed ${esc(new Date().toLocaleString('id-ID'))}</span></div>
  <div class="eyebrow">Recipe card${recipe.type ? ` · ${esc(recipe.type)}` : ''}${recipe.is_default ? ' · Default' : ''}</div>
  <h1>${esc(name)}</h1>
  <div class="meta">
    <span>Makes <strong>${esc(fmtQty(recipe.qty))} ${esc(uom)}</strong></span>
    <span><strong>${materials.length}</strong> ingredients</span>
    ${sku ? `<span>SKU <strong>${esc(sku)}</strong></span>` : ''}
    <span>Recipe ID <strong>${esc(recipe.id)}</strong></span>
  </div>
  ${
    materials.length
      ? `<table>
    <thead><tr><th>#</th><th></th><th>Ingredient</th><th class="r">Qty</th><th class="r">Stock</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
      : '<div class="empty">No ingredients defined.</div>'
  }
  <div class="notes"><b>Notes</b></div>
  <div class="sign"><div>Prepared by</div><div>Checked by</div><div>Date</div></div>
</body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument!
  doc.open()
  doc.write(html)
  doc.close()
  const win = iframe.contentWindow!
  const cleanup = () => setTimeout(() => iframe.remove(), 500)
  win.addEventListener('afterprint', cleanup)
  setTimeout(() => iframe.isConnected && iframe.remove(), 60_000)
  setTimeout(() => {
    win.focus()
    win.print()
  }, 150)
}
