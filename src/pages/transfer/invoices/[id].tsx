import { useRouter } from 'next/router'
import InvoiceDetail from '@/views/Invoices/InvoiceDetail'

export default function InvoiceDetailPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <InvoiceDetail id={id} />
}
