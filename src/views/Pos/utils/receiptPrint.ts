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

const BRANCH_FALLBACK = {
  branchName: 'DAPUR COKELAT',
  branchCity: 'CIBUBUR',
  branchAddress: 'Jl. Alternatif Cibubur Km 6, Cileungsi - Nagrak',
  branchCity2: 'Bogor',
  branchPhone: '021-8248 6446',
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

/** Convert the on-screen receipt into the ESC/POS (WebUSB) builder shape. */
export function mapReceiptToBuilder(r: ReceiptData): PrinterReceiptData {
  const paymentTotal = r.payments.reduce((s, p) => s + p.amount, 0)
  const paymentMethod = r.payments[0]?.method?.toUpperCase() || 'CASH'
  return {
    companyName: COMPANY.name,
    companyAddress: COMPANY.address,
    npwp: COMPANY.npwp,
    branchName: r.branchName?.toUpperCase() || BRANCH_FALLBACK.branchName,
    branchCity: BRANCH_FALLBACK.branchCity,
    branchAddress: r.branchAddress || BRANCH_FALLBACK.branchAddress,
    branchCity2: BRANCH_FALLBACK.branchCity2,
    branchPhone: r.branchPhone || BRANCH_FALLBACK.branchPhone,
    invoiceNo: r.invoiceNo,
    datetime: `${r.date} ${r.time}`,
    cashier: r.cashierName,
    items: r.items,
    gross: r.grossAmount,
    discount: r.discountAmount,
    total: r.totalAmount,
    payment: paymentTotal,
    paymentMethod,
  }
}

/** Printable HTML mirroring PosReceipt's layout (used by the iframe fallback). */
export function buildReceiptHtml(r: ReceiptData): string {
  const divider = '--------------------------------------'
  const thin = '- - - - - - - - - - - - - - - - - - - -'
  const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })
  const row = (left: string, right: string) =>
    `<div style="display:flex;justify-content:space-between;"><span>${left}</span><span>${right}</span></div>`
  const paymentTotal = r.payments.reduce((s, p) => s + p.amount, 0)

  return `
    <div style="text-align:center;margin-bottom:6px;font-size:11px;">
      ${COMPANY.name}<br>
      ${COMPANY.address}<br>
      NPWP: ${COMPANY.npwp}
    </div>
    <div style="text-align:center;margin-bottom:6px;">
      <strong style="font-size:14px;">DAPUR COKELAT</strong><br>
      <strong>${escapeHtml(r.branchName.toUpperCase())}</strong><br>
      ${r.branchAddress ? `<span style="font-size:11px;">${escapeHtml(r.branchAddress)}</span><br>` : ''}
      ${r.branchPhone ? escapeHtml(r.branchPhone) : ''}
    </div>
    <div>${divider}</div>
    <div style="margin:4px 0;">
      ${r.date} ${r.time}<br>
      ${escapeHtml(r.invoiceNo)}<br>
      ${escapeHtml(r.cashierName)}
      ${r.customerName ? `<br>${escapeHtml(r.customerName)}` : ''}
    </div>
    <div>${divider}</div>
    ${r.isPrinted && r.reprintBy
      ? `<div style="margin:4px 0;">Reprint by ${escapeHtml(r.reprintBy)} on<br>${r.reprintAt ?? ''}</div><div>${divider}</div>`
      : ''}
    <div style="margin:4px 0;">
      ${r.items
        .map(
          (item) => `
            <div>${escapeHtml(item.name)}</div>
            <div style="display:flex;justify-content:space-between;">
              <span>${fmt(item.qty)} x ${fmt(item.price)}</span>
              <span>${fmt(item.subtotal)}</span>
            </div>`,
        )
        .join('')}
    </div>
    <div>${thin}</div>
    <div style="margin:4px 0;">
      ${row('GROSS', fmt(r.grossAmount))}
      ${r.discountAmount > 0 ? row('DISCOUNT', fmt(r.discountAmount)) : ''}
    </div>
    <div>${thin}</div>
    <div style="margin:4px 0;">
      <div style="display:flex;justify-content:space-between;font-weight:bold;">
        <span>TOTAL</span><span>${fmt(r.totalAmount)}</span>
      </div>
      ${r.payments.map((p) => row(escapeHtml(p.method.toUpperCase()), fmt(p.amount))).join('')}
      ${r.changeAmount && r.changeAmount > 0 ? row('KEMBALI', fmt(r.changeAmount)) : ''}
    </div>
    <div>${thin}</div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;margin:4px 0;">
      <span>PAYMENT</span><span>${fmt(paymentTotal)}</span>
    </div>
    <div style="margin:4px 0;">${escapeHtml(r.branchName.toUpperCase())} – ${escapeHtml(r.orderType.toUpperCase())}</div>
    <div>${divider}</div>
    <div style="text-align:center;font-size:11px;margin:6px 0;">
      ChocoCall : 0811-1920-9900<br>
      ALL ABOUT CHOCOLATES &amp; CAKES
    </div>
    <div>${divider}</div>
    <div style="text-align:center;font-size:11px;margin:4px 0;">Harga sudah termasuk pajak</div>
    <div>${divider}</div>
    <div style="text-align:center;font-size:11px;margin:4px 0;">
      Keluhan mengenai produk dapat diterima maksimal 1x24 jam sejak tanggal pembelian
    </div>
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
          line-height: 1.3;
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
