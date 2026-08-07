import ReceiptForm from '@/views/Receipts/ReceiptForm'
import { useRouter } from 'next/router'

export default function ReceiptCreatePage() {
  const router = useRouter()
  const delivery_id = router.query.delivery_id ? Number(router.query.delivery_id) : undefined

  return (
    <ReceiptForm 
      mode="create" 
      prefill={
        delivery_id ? { delivery_id } : undefined
      } 
    />
  )
}
