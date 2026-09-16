import { useRouter } from 'next/router'
import ReceiptDetail from '@/views/Receipts/ReceiptDetail'

export default function ReceiptDetailPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <ReceiptDetail id={id} />
}

export async function getServerSideProps() {
  return { props: {} }
}
