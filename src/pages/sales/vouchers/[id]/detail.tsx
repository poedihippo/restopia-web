import { useRouter } from 'next/router'
import VoucherDetail from '@/views/Vouchers/VoucherDetail'

export default function VoucherDetailPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <VoucherDetail id={id} />
}
