import type { ReceiptData } from '@/components/PosReceipt'
import type { ReceiptData as PrinterReceiptData } from '@/lib/print/receiptBuilder'

// TODO: pull from /v1/companies and /v1/branches once backend exposes
// company name / address / NPWP and branch city/phone.
const COMPANY = {
  name: 'PT. Sumber Cemerlang Mandiri',
  address:
    'Ruko Golden Boulevard, J, 9, Lengkong Karya, Serpong Utara, Kota Tangerang Selatan, Banten, 15331',
  npwp: '71.008.539.0-411.000',
}

const BRANCH_FALLBACK_NAME = 'DAPUR COKELAT'

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Convert the on-screen receipt into the ESC/POS (WebUSB) builder shape. */
export function mapReceiptToBuilder(r: ReceiptData): PrinterReceiptData {
  const isOnline = r.orderType === 'online'
  // Online orders are paid on the marketplace: PAYMENT = total, and the method
  // line names the merchant (e.g. "SHOPEE FOOD").
  const paymentTotal = isOnline ? r.totalAmount : r.payments.reduce((s, p) => s + p.amount, 0)
  const paymentMethod = isOnline
    ? (r.salesChannelName || 'ONLINE').toUpperCase()
    : r.payments.map((p) => p.method.toUpperCase()).join(' + ') || 'CASH'
  return {
    companyName: COMPANY.name,
    companyAddress: COMPANY.address,
    npwp: COMPANY.npwp,
    branchName: r.branchName?.toUpperCase() || BRANCH_FALLBACK_NAME,
    // Address comes from the branch record (branch.address); no hard-coded fallback,
    // so one outlet never prints another outlet's address.
    branchAddress: r.branchAddress ?? '',
    branchPhone: r.branchPhone ?? '',
    invoiceNo: r.invoiceNo,
    datetime: `${r.date} ${r.time}`,
    cashier: r.cashierName,
    reprintNote: r.isPrinted && r.reprintBy ? `Reprint by ${r.reprintBy} on ${r.reprintAt ?? ''}` : '',
    items: r.items,
    gross: r.grossAmount,
    discount: r.discountAmount,
    tax: r.taxAmount ?? 0,
    taxIncluded: !!r.taxIncluded,
    total: r.totalAmount,
    payment: paymentTotal,
    paymentMethod,
    change: r.changeAmount ?? 0,
  }
}

/** Printable HTML mirroring PosReceipt's layout (used by the iframe fallback). */
export function buildReceiptHtml(r: ReceiptData): string {
  // CSS borders always fit the paper width; dash strings wrap on narrow rolls.
  const divider = '<div style="border-top:1px dashed #000;margin:4px 0;"></div>'
  const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  const b = mapReceiptToBuilder(r)
  // Amount rows: label column ends where the item prices end, value column on the right.
  const amountRow = (label: string, value: string, bold = false) =>
    `<div style="display:grid;grid-template-columns:1fr 34%;${bold ? 'font-weight:bold;' : ''}"><span style="text-align:right;">${label}</span><span style="text-align:right;">${value}</span></div>`
  const valueRule = '<div style="display:grid;grid-template-columns:1fr 34%;"><span></span><span style="border-top:1px dashed #000;margin:3px 0;"></span></div>'
  const center = (html: string) => `<div style="text-align:center;margin:4px 0;">${html}</div>`

  return `
    ${center(`${escapeHtml(b.companyName)}<br>${escapeHtml(b.companyAddress)}<br>NPWP: ${escapeHtml(b.npwp)}`)}
    <div style="text-align:center;margin:8px 0 4px;">
      DAPUR COKELAT<br>
      ${escapeHtml(b.branchName)}<br>
      ${b.branchAddress ? `${escapeHtml(b.branchAddress)}<br>` : ''}
      ${b.branchPhone ? escapeHtml(b.branchPhone) : ''}
    </div>
    ${divider}
    <div style="margin:4px 0;">
      ${escapeHtml(b.datetime)}<br>
      ${escapeHtml(b.invoiceNo)}<br>
      ${escapeHtml(b.cashier)}
    </div>
    ${divider}
    ${b.reprintNote ? `<div style="margin:4px 0;">${escapeHtml(b.reprintNote)}</div>${divider}` : ''}
    <div style="margin:4px 0;">
      ${b.items
        .map(
          (item) => `
            <div>${escapeHtml(item.name)}</div>
            <div style="display:grid;grid-template-columns:auto 1fr 34%;">
              <span>&nbsp;${fmt(item.qty)} x</span>
              <span style="text-align:right;">${fmt(item.price)}</span>
              <span style="text-align:right;">${fmt(item.subtotal)}</span>
            </div>`,
        )
        .join('')}
    </div>
    ${valueRule}
    ${amountRow('SUBTOTAL', fmt(b.gross))}
    ${(b.tax ?? 0) > 0 && !b.taxIncluded ? amountRow('PPN', fmt(b.tax ?? 0)) : ''}
    ${valueRule}
    ${amountRow('TOTAL', fmt(b.total))}
    ${valueRule}
    ${amountRow('PAYMENT', fmt(b.payment))}
    ${(b.change ?? 0) > 0 ? amountRow('KEMBALIAN', fmt(b.change ?? 0)) : ''}
    <div style="margin:2px 0 4px;">${escapeHtml(b.paymentMethod)}</div>
    ${divider}
    ${center('Informasi diskon tidak ditampilkan pada struk. Adapun diskon yang diterima customer mengikuti yang ada di aplikasi customer.')}
    ${divider}
    ${center('Dapur Cokelat Delivery : 0811-1920-9900<br>ALL ABOUT CHOCOLATES &amp; CAKES')}
    ${divider}
    ${center('Harga sudah termasuk pajak.')}
    ${divider}
    ${center('Keluhan mengenai produk dapat diterima maksimal 1x24 jam sejak tanggal pembelian')}
  `
}

/** Print through a hidden iframe + window.print() (works without WebUSB). */
export function printReceiptViaIframe(receipt: ReceiptData): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    return
  }

  doc.open()
  doc.write(`<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: 76mm auto; margin: 2mm; }
        body {
          margin: 0;
          padding: 4mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.5;
          width: 70mm;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        * { box-sizing: border-box; }
      </style>
    </head>
    <body>${buildReceiptHtml(receipt)}</body>
    </html>`)
  doc.close()

  iframe.contentWindow?.focus()
  iframe.contentWindow?.print()

  setTimeout(() => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
  }, 1000)
}
