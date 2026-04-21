import { useRouter } from 'next/router'
import DeliveryEdit from '@/views/Deliveries/DeliveryEdit'

export default function DeliveryEditPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <DeliveryEdit id={id} />
}
