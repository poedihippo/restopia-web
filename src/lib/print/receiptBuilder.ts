import { align, concat, cut, feed, init, lineFeed, text } from './escpos'

export interface ReceiptData {
  companyName: string
  companyAddress: string
  npwp: string
  branchName: string
  branchCity: string
  branchAddress: string
  branchCity2: string
  branchPhone: string
  invoiceNo: string
  datetime: string
  cashier: string
  items: Array<{
    name: string
    qty: number
    price: number
    subtotal: number
  }>
  gross: number
  discount: number
  total: number
  payment: number
  paymentMethod: string
}

const fmtIDR = (n: number) =>
  Math.round(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })

function separator(charsPerLine: number): string {
  return '-'.repeat(charsPerLine)
}

function rightSeparator(charsPerLine: number): string {
  const dashLen = 13
  const pad = Math.max(0, charsPerLine - dashLen)
  return ' '.repeat(pad) + '-'.repeat(dashLen)
}

function padLeft(s: string, width: number) {
  return s.length >= width ? s : ' '.repeat(width - s.length) + s
}

function padRight(s: string, width: number) {
  return s.length >= width ? s : s + ' '.repeat(width - s.length)
}

function formatItemLine(
  qty: number,
  price: number,
  subtotal: number,
  charsPerLine: number,
): string {
  const left = ` ${qty} x  ${fmtIDR(price)}`
  const right = fmtIDR(subtotal)
  if (left.length + right.length >= charsPerLine) {
    return left + ' ' + right
  }
  return left + ' '.repeat(charsPerLine - left.length - right.length) + right
}

function formatTotalLine(
  label: string,
  value: number,
  charsPerLine: number,
): string {
  const valueWidth = 14
  const labelWidth = Math.max(0, charsPerLine - valueWidth)
  return padLeft(label, labelWidth) + padLeft(fmtIDR(value), valueWidth)
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
  charsPerLine: number = 40,
): Uint8Array {
  const w = charsPerLine
  const sep = separator(w)
  const rsep = rightSeparator(w)
  const line = (s: string) => concat(text(s), lineFeed())

  const chunks: Uint8Array[] = []
  chunks.push(init())

  // Company header (centered).
  chunks.push(align('center'))
  chunks.push(line(r.companyName))
  for (const segment of wrap(r.companyAddress, w)) chunks.push(line(segment))
  chunks.push(line(`NPWP: ${r.npwp}`))
  chunks.push(lineFeed())

  // Branch header (centered).
  chunks.push(line(r.branchName))
  chunks.push(line(r.branchCity))
  for (const segment of wrap(r.branchAddress, w)) chunks.push(line(segment))
  chunks.push(line(r.branchCity2))
  chunks.push(line(r.branchPhone))

  // Order metadata.
  chunks.push(align('left'))
  chunks.push(line(sep))
  chunks.push(line(r.datetime))
  chunks.push(line(r.invoiceNo))
  chunks.push(line(r.cashier))
  chunks.push(line(sep))

  // Items.
  for (const item of r.items) {
    for (const segment of wrap(item.name, w)) chunks.push(line(segment))
    chunks.push(line(formatItemLine(item.qty, item.price, item.subtotal, w)))
  }

  // Totals.
  chunks.push(line(rsep))
  chunks.push(line(formatTotalLine('GROSS', r.gross, w)))
  chunks.push(line(rsep))
  chunks.push(line(formatTotalLine('TOTAL', r.total, w)))
  chunks.push(line(rsep))
  chunks.push(line(formatTotalLine('PAYMENT', r.payment, w)))
  chunks.push(line(r.paymentMethod))

  // Disclaimer block (left aligned).
  chunks.push(line(sep))
  chunks.push(line('Informasi diskon tidak ditampilkan pada struk.'))
  chunks.push(line('Adapun diskon yang diterima customer mengikuti'))
  chunks.push(line('     yang ada di aplikasi customer.'))
  chunks.push(line(sep))

  // Centered footer line.
  chunks.push(align('center'))
  chunks.push(line('ChocoCall : 0811-1920-9900'))
  chunks.push(line('ALL ABOUT CHOCOLATES & CAKES'))

  // Tax notice (left aligned separator wrapping a centered line).
  chunks.push(align('left'))
  chunks.push(line(sep))
  chunks.push(align('center'))
  chunks.push(line('Harga sudah termasuk pajak'))
  chunks.push(align('left'))
  chunks.push(line(sep))

  // Complaint policy.
  chunks.push(line('Keluhan mengenai produk dapat diterima'))
  chunks.push(line('maksimal 1x24 jam sejak tanggal pembelian'))

  // Extra feed so the cut clears the printed content past the tear bar.
  chunks.push(feed(6))
  chunks.push(cut())

  return concat(...chunks)
}
