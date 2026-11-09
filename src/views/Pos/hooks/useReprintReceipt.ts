import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { usePrinter } from '@/hooks/usePrinter'
import { buildReceiptBytes } from '@/lib/print/receiptBuilder'
import { salesOrdersService } from '@/services/sales-orders.service'
import { paymentsService } from '@/services/payments.service'
import { mapReceiptToBuilder, printReceiptViaIframe } from '../utils/receiptPrint'
import { receiptFromOrder } from '../utils/receiptFromOrder'

/**
 * Reprint the POS receipt of a saved sales order: thermal printer when
 * connected, otherwise the browser print dialog. Marked "Reprint by …".
 */
export function useReprintReceipt() {
  const { user } = useAuth()
  const printer = usePrinter()
  const [printingId, setPrintingId] = useState<number | null>(null)

  const reprint = useCallback(
    async (orderId: number) => {
      if (!orderId || printingId) return
      setPrintingId(orderId)
      try {
        const [orderRes, allocRes] = await Promise.all([
          salesOrdersService.findById(orderId, {
            include: 'branch,customer,created_by,sales_order_details,sales_channel',
          }),
          paymentsService.listAllocations({
            per_page: 50,
            include: 'payment',
            'filter[sales_order_id]': orderId,
          }),
        ])
        const order = (orderRes.data as any)?.data
        const allocations: any[] = (allocRes.data as any)?.data ?? []
        const receipt = receiptFromOrder(order, allocations, { reprintBy: (user as any)?.name })

        let printed = false
        if (printer.status === 'connected') {
          try {
            await printer.print(buildReceiptBytes(mapReceiptToBuilder(receipt)))
            printed = true
          } catch (e) {
            console.error('[Reprint] WebUSB failed, falling back to browser print', e)
          }
        }
        if (!printed) printReceiptViaIframe(receipt)
      } catch (err: any) {
        toast.error(err?.response?.data?.message || 'Failed to reprint receipt')
      } finally {
        setPrintingId(null)
      }
    },
    [printer, printingId, user],
  )

  return { reprint, printingId }
}
