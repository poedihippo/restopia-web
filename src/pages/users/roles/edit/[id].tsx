import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function RoleEditPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/users/roles')
  }, [router])
  return null
}
