import DeliveryForm from '@/views/Deliveries/DeliveryForm'
import { useRouter } from 'next/router'

export default function DeliveryCreatePage() {
  const router = useRouter()
  const po_id = router.query.po_id ? Number(router.query.po_id) : undefined
  const so_id = router.query.so_id ? Number(router.query.so_id) : undefined

  const source_type = router.query.source_type as 'po_from_supplier' | 'po_from_branch' | 'so_to_branch' | undefined

  return (
    <DeliveryForm 
      mode="create" 
      prefill={
        po_id ? { purchase_order_id: po_id, source_type: source_type || 'po_from_branch' } : 
        so_id ? { sales_order_id: so_id, source_type: source_type || 'so_to_branch' } : 
        undefined
      } 
    />
  )
}
