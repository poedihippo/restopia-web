import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function VoucherEditPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/sales/vouchers')
  }, [router])
  return null
}
