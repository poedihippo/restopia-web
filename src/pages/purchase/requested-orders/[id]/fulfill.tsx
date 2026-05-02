import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'

const DeliveryForm = dynamic(
  () => import('@/views/Deliveries/DeliveryForm'),
  { ssr: false },
)

export default function FulfillRequestPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  if (!router.isReady || !Number.isFinite(id) || id <= 0) {
    return null
  }
  return (
    <DeliveryForm
      mode="create"
      prefill={{
        source_type: 'po_from_branch',
        purchase_order_id: id,
      }}
    />
  )
}
