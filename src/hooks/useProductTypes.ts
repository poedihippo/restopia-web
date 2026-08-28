'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { enumsService } from '@/services/enums.service'

export const PRODUCT_TYPE_OPTIONS = [
  'raw',
  'wip',
  'final',
  'supply',
] as const

export type ProductTypeValue = (typeof PRODUCT_TYPE_OPTIONS)[number]

export function useProductTypes() {
  const { data, isLoading } = useQuery({
    queryKey: ['enums'],
    queryFn: () => enumsService.getAll().then((r) => r.data),
  })

  const all = data?.['ProductType'] ?? PRODUCT_TYPE_OPTIONS
  return { options: all as ProductTypeValue[], isLoading }
}

export function useActiveBranchProductTypes(): string | undefined {
  const { user } = useAuth()
  const value = user?.branch?.company?.product_types
  if (!value) return undefined
  return value
}

export function isProductTypeAllowed(
  product?: { type?: string | null; product_category?: { name?: string | null } | null; name?: string | null } | string | null,
  allowedTypesStr?: string | null
): boolean {
  if (!allowedTypesStr) return true
  const allowed = allowedTypesStr
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length === 0) return true

  if (!product) return false

  let rawType = ''
  let catName = ''
  let prodName = ''

  if (typeof product === 'string') {
    rawType = product.trim().toLowerCase()
  } else {
    rawType = (product.type || '').trim().toLowerCase()
    catName = (product.product_category?.name || '').trim().toLowerCase()
    prodName = (product.name || '').trim().toLowerCase()
  }

  let effectiveType = rawType
  if (!effectiveType) {
    if (catName.includes('raw') || catName.includes('bahan baku')) effectiveType = 'raw'
    else if (catName.includes('wip') || catName.includes('unfinish') || catName.includes('setengah')) effectiveType = 'wip'
    else if (
      catName.includes('suppl') ||
      catName.includes('box') ||
      catName.includes('pack') ||
      catName.includes('perlengkapan') ||
      prodName.startsWith('box ') ||
      prodName.includes('box reguler')
    )
      effectiveType = 'supply'
    else if (catName.includes('cake') || catName.includes('bread') || catName.includes('finish') || catName.includes('jadi'))
      effectiveType = 'final'
  }

  if (!effectiveType) {
    return false
  }

  return (
    allowed.includes(effectiveType) ||
    (effectiveType === 'supply' && allowed.includes('supplies')) ||
    (effectiveType === 'supplies' && allowed.includes('supply'))
  )
}
