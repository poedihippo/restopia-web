import { useRouter } from 'next/router'
import DeliveryDetail from '@/views/Deliveries/DeliveryDetail'

export default function DeliveryDetailPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <DeliveryDetail id={id} />
}
