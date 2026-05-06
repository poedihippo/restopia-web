import {
  align,
  bold,
  concat,
  cut,
  feed,
  init,
  lineFeed,
  text,
} from './escpos'

export interface ReceiptData {
  branchName: string
  branchAddress: string
  npwp?: string
  companyName: string
  city: string
  phone?: string
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
  footer?: string[]
}

const fmtIDR = (n: number) =>
  Math.round(n).toLocaleString('id-ID', { maximumFractionDigits: 0 })

function pad(s: string, width: number, side: 'left' | 'right' = 'left') {
  if (s.length >= width) return s
  const filler = ' '.repeat(width - s.length)
  return side === 'left' ? s + filler : filler + s
}

function row(left: string, right: string, width: number) {
  if (left.length + right.length + 1 > width) {
    return left + '\n' + pad(right, width, 'right')
  }
  return left + ' '.repeat(width - left.length - right.length) + right
}

function wrap(s: string, width: number): string[] {
  if (s.length <= width) return [s]
  const out: string[] = []
  for (let i = 0; i < s.length; i += width) {
    out.push(s.slice(i, i + width))
  }
  return out
}

const div = (w: number) => '-'.repeat(w)
const thin = (w: number) =>
  Array.from({ length: Math.floor(w / 2) }, () => '-').join(' ')

export function buildReceiptBytes(
  r: ReceiptData,
  charsPerLine: number = 40,
): Uint8Array {
  const w = charsPerLine
  const line = (s: string) => concat(text(s), lineFeed())

  const chunks: Uint8Array[] = []
  chunks.push(init())

  // Header — company info, centered, small.
  chunks.push(align('center'))
  for (const segment of wrap(r.companyName, w)) chunks.push(line(segment))
  for (const segment of wrap(r.branchAddress, w)) chunks.push(line(segment))
  if (r.city) chunks.push(line(r.city))
  if (r.npwp) chunks.push(line(`NPWP: ${r.npwp}`))
  chunks.push(lineFeed())

  // Branch name banner, bold.
  chunks.push(bold(true))
  chunks.push(line('DAPUR COKELAT'))
  chunks.push(line(r.branchName.toUpperCase()))
  chunks.push(bold(false))
  if (r.phone) chunks.push(line(r.phone))
  chunks.push(line(div(w)))

  // Order metadata, left aligned.
  chunks.push(align('left'))
  chunks.push(line(r.datetime))
  chunks.push(line(r.invoiceNo))
  chunks.push(line(r.cashier))
  chunks.push(line(div(w)))

  // Items: name on its own line(s), then qty x price + subtotal.
  for (const item of r.items) {
    for (const segment of wrap(item.name, w)) chunks.push(line(segment))
    const left = `  ${item.qty} x ${fmtIDR(item.price)}`
    const right = fmtIDR(item.subtotal)
    chunks.push(line(row(left, right, w)))
  }
  chunks.push(line(thin(w)))

  // Totals block.
  chunks.push(line(row('GROSS', fmtIDR(r.gross), w)))
  if (r.discount > 0) {
    chunks.push(line(row('DISCOUNT', fmtIDR(r.discount), w)))
  }
  chunks.push(line(thin(w)))
  chunks.push(bold(true))
  chunks.push(line(row('TOTAL', fmtIDR(r.total), w)))
  chunks.push(bold(false))
  chunks.push(line(row(r.paymentMethod.toUpperCase(), fmtIDR(r.payment), w)))
  chunks.push(line(thin(w)))
  chunks.push(bold(true))
  chunks.push(line(row('PAYMENT', fmtIDR(r.payment), w)))
  chunks.push(bold(false))
  chunks.push(line(div(w)))

  // Footer block, centered.
  chunks.push(align('center'))
  const footer = r.footer ?? [
    'ChocoCall : 0811-1920-9900',
    'ALL ABOUT CHOCOLATES & CAKES',
    div(w),
    'Harga sudah termasuk pajak',
  ]
  for (const f of footer) {
    for (const segment of wrap(f, w)) chunks.push(line(segment))
  }
  chunks.push(align('left'))

  // Paper feed and (no-op on TM-U220) cut.
  chunks.push(feed(4))
  chunks.push(cut())

  return concat(...chunks)
}
