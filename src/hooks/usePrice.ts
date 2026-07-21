import { useAuth } from './useAuth'

export function usePrice() {
  const { hasPermission } = useAuth()
  const canReadPrice = hasPermission('common.price.read')

  const formatPrice = (value: number | null | undefined, prefix: string = 'Rp ') => {
    if (!canReadPrice) return `${prefix}***`
    return `${prefix}${Number(value ?? 0).toLocaleString('id-ID')}`
  }

  return { canReadPrice, formatPrice }
}
