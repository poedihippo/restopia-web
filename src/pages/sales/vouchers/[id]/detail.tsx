import { useEffect } from 'react'
import { useRouter } from 'next/router'

// Voucher detail now opens as a side panel on the list page.
export default function VoucherDetailPage() {
  const router = useRouter()
  useEffect(() => {
    if (!router.isReady) return
    router.replace({ pathname: '/sales/vouchers', query: { detail: router.query.id } })
  }, [router])
  return null
}
