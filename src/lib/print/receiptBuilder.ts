import { align, concat, cut, feed, init, lineFeed, lineSpacing, text } from './escpos'

export interface ReceiptData {
  companyName: string
  companyAddress: string
  npwp: string
  branchName: string
  /** branch.address from the API; empty hides the line. */
  branchAddress: string
  /** Empty hides the line. */
  branchPhone: string
  invoiceNo: string
  datetime: string
  cashier: string
  /** "Reprint by X on Y" for reprinted receipts; empty hides the line. */
  reprintNote?: string
  items: Array<{
    name: string
    qty: number
    price: number
    subtotal: number
  }>
  gross: number
  discount: number
  /** PPN (after the voucher discount); 0 hides the line. */
  tax?: number
  taxIncluded?: boolean
  total: number
  payment: number
  paymentMethod: string
  /** Cash change (kembalian); 0 hides the line. */
  change?: number
}

const fmtIDR = (n: number) =>
  Math.round(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })
const fmtQty = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 })

function separator(charsPerLine: number): string {
  return '-'.repeat(charsPerLine)
}

// Width of the right-hand amount column (matches the outlet's existing receipts).
const VALUE_WIDTH = 16

function rightSeparator(charsPerLine: number): string {
  const dashLen = VALUE_WIDTH
  const pad = Math.max(0, charsPerLine - dashLen)
  return ' '.repeat(pad) + '-'.repeat(dashLen)
}

function padLeft(s: string, width: number) {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s
}

function padRight(s: string, width: number) {
  return s.length >= width ? s : s + ' '.repeat(width - s.length)
}

// " 1 x        126.000         126.000" — unit price ends where the total
// labels end, the line amount sits in the right-hand value column.
function formatItemLine(
  qty: number,
  price: number,
  subtotal: number,
  charsPerLine: number,
): string {
  const labelWidth = Math.max(0, charsPerLine - VALUE_WIDTH)
  const left = ` ${fmtQty(qty)} x`
  const priceCol = padLeft(fmtIDR(price), Math.max(0, labelWidth - left.length))
  return left + priceCol + padLeft(fmtIDR(subtotal), VALUE_WIDTH)
}

function formatTotalLine(
  label: string,
  value: number,
  charsPerLine: number,
): string {
  const labelWidth = Math.max(0, charsPerLine - VALUE_WIDTH)
  return padLeft(label, labelWidth) + padLeft(fmtIDR(value), VALUE_WIDTH)
}

// Word-wrap on whitespace. A single word longer than width is hard-cut so
// the printer never overruns the right margin.
function wrap(s: string, width: number): string[] {
  if (!s) return ['']
  const out: string[] = []
  const words = s.split(/\s+/).filter(Boolean)
  let line = ''
  for (const word of words) {
    if (word.length > width) {
      if (line) {
        out.push(line)
        line = ''
      }
      let rest = word
      while (rest.length > width) {
        out.push(rest.slice(0, width))
        rest = rest.slice(width)
      }
      line = rest
      continue
    }
    const next = line ? `${line} ${word}` : word
    if (next.length > width) {
      out.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) out.push(line)
  if (out.length === 0) out.push('')
  return out
}

export function buildReceiptBytes(
  r: ReceiptData,
  charsPerLine: number = 48,
): Uint8Array {
  const w = charsPerLine
  const sep = separator(w)
  const rsep = rightSeparator(w)
  const line = (s: string) => concat(text(s), lineFeed())

  const chunks: Uint8Array[] = []
  chunks.push(init())
  // A little more air between lines than the printer default (24 on TM-U220).
  chunks.push(lineSpacing(30))

  // Company header (centered).
  chunks.push(align('center'))
  chunks.push(line(r.companyName))
  for (const segment of wrap(r.companyAddress, w)) chunks.push(line(segment))
  chunks.push(line(`NPWP: ${r.npwp}`))
  chunks.push(lineFeed())

  // Branch header (centered).
  chunks.push(line('DAPUR COKELAT'))
  chunks.push(line(r.branchName))
  if (r.branchAddress) {
    for (const segment of wrap(r.branchAddress, w)) chunks.push(line(segment))
  }
  if (r.branchPhone) chunks.push(line(r.branchPhone))

  // Order metadata.
  chunks.push(align('left'))
  chunks.push(line(sep))
  chunks.push(line(r.datetime))
  chunks.push(line(r.invoiceNo))
  chunks.push(line(r.cashier))
  chunks.push(line(sep))
  if (r.reprintNote) {
    for (const segment of wrap(r.reprintNote, w)) chunks.push(line(segment))
    chunks.push(line(sep))
  }

  // Items.
  for (const item of r.items) {
    for (const segment of wrap(item.name, w)) chunks.push(line(segment))
    chunks.push(line(formatItemLine(item.qty, item.price, item.subtotal, w)))
  }

  // Totals. Discounts are not printed (see the disclaimer below).
  chunks.push(line(rsep))
  chunks.push(line(formatTotalLine('SUBTOTAL', r.gross, w)))
  if ((r.tax ?? 0) > 0 && !r.taxIncluded) {
    chunks.push(line(formatTotalLine('PPN', r.tax ?? 0, w)))
  }
  chunks.push(line(rsep))
  chunks.push(line(formatTotalLine('TOTAL', r.total, w)))
  chunks.push(line(rsep))
  chunks.push(line(formatTotalLine('PAYMENT', r.payment, w)))
  if ((r.change ?? 0) > 0) chunks.push(line(formatTotalLine('KEMBALIAN', r.change ?? 0, w)))
  // Payment method, or the merchant for online orders (e.g. "SHOPEE FOOD").
  for (const segment of wrap(r.paymentMethod, w)) chunks.push(line(segment))

  // Disclaimer block (centered between separators).
  chunks.push(line(sep))
  chunks.push(align('center'))
  chunks.push(line('Informasi diskon tidak ditampilkan pada struk.'))
  chunks.push(line('Adapun diskon yang diterima customer mengikuti'))
  chunks.push(line('yang ada di aplikasi customer.'))
  chunks.push(align('left'))
  chunks.push(line(sep))

  // Centered footer line.
  chunks.push(align('center'))
  chunks.push(line('Dapur Cokelat Delivery : 0811-1920-9900'))
  chunks.push(line('ALL ABOUT CHOCOLATES & CAKES'))

  // Tax notice (left aligned separator wrapping a centered line).
  chunks.push(align('left'))
  chunks.push(line(sep))
  chunks.push(align('center'))
  chunks.push(line('Harga sudah termasuk pajak.'))
  chunks.push(align('left'))
  chunks.push(line(sep))

  // Complaint policy.
  chunks.push(align('center'))
  chunks.push(line('Keluhan mengenai produk dapat diterima'))
  chunks.push(line('maksimal 1x24 jam sejak tanggal pembelian'))
  chunks.push(align('left'))

  // Extra feed so the cut clears the printed content past the tear bar.
  chunks.push(feed(6))
  chunks.push(cut())

  return concat(...chunks)
}
