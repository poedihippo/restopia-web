import { useRouter } from 'next/router'
import ReceiptEdit from '@/views/Receipts/ReceiptEdit'

export default function ReceiptEditPage() {
  const router = useRouter()
  const id = Number(router.query.id)
  return <ReceiptEdit id={id} />
}

export async function getServerSideProps() {
  return { props: {} }
}
