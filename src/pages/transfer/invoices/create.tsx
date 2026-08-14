import dynamic from 'next/dynamic'

const InvoiceForm = dynamic(() => import('@/views/Invoices/InvoiceForm'), { ssr: false })

export default function CreateInvoicePage() {
  return <InvoiceForm />
}
