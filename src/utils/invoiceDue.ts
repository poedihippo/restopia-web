import { parseApiDate } from '@/utils/date'

export interface InvoiceDueFields {
  due_date?: string | null
  status?: string | null
  payment_status?: string | null
  total_payment?: number | null
  total_price?: number | null
}

export interface InvoiceDueInfo {
  dueDate: Date | null
  isPaid: boolean
  /** Unpaid (or partly paid), not void, and the due date is before today. */
  isOverdue: boolean
  /** Whole days past the due date; 0 when not overdue. */
  daysOverdue: number
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Due-date state of an invoice, shared by the invoice list and detail. */
export function getInvoiceDueInfo(invoice: InvoiceDueFields | null | undefined): InvoiceDueInfo {
  const dueDate = parseApiDate(invoice?.due_date ?? null)
  const total = Number(invoice?.total_price ?? 0)
  const isPaid =
    invoice?.status === 'paid' ||
    invoice?.payment_status === 'paid' ||
    (total > 0 && Number(invoice?.total_payment ?? 0) >= total)
  const isVoid = invoice?.status === 'void'

  if (!dueDate || isPaid || isVoid) {
    return { dueDate, isPaid, isOverdue: false, daysOverdue: 0 }
  }
  const diffMs = startOfDay(new Date()).getTime() - startOfDay(dueDate).getTime()
  const daysOverdue = Math.round(diffMs / 86_400_000)
  return { dueDate, isPaid, isOverdue: daysOverdue > 0, daysOverdue: Math.max(0, daysOverdue) }
}
