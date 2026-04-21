import { useState } from 'react'
import { useRouter } from 'next/router'
import VoucherSheet from '@/views/Vouchers/VoucherSheet'

export default function VoucherCreatePage() {
  const router = useRouter()
  const [open] = useState(true)

  return (
    <VoucherSheet
      open={open}
      onClose={() => router.push('/sales/vouchers')}
      editData={null}
    />
  )
}
