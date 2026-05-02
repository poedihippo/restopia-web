import { useRouter } from 'next/router'
import TransferInDetail from '@/views/StockTransfer/TransferInDetail'

export default function TransferInReceivePage() {
  const router = useRouter()
  const id = Number(router.query.id)
  if (!router.isReady || !Number.isFinite(id) || id <= 0) {
    return null
  }
  return <TransferInDetail id={id} />
}
