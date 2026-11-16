import { useEffect } from 'react'
import { useRouter } from 'next/router'

// Old per-type URL: /dashboard now picks the view from the active branch type.
export default function LegacyDashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])
  return null
}
