import { useQueries } from '@tanstack/react-query'
import { productUomsService } from '@/services/product-uoms.service'
import { packagingChains } from '@/utils/unitDisplay'

/**
 * Packaging chains ("1 PACK → 300 GR") per product id.
 *
 * Document endpoints (e.g. purchase-orders with
 * purchase_order_details.product_uom.product) do not nest the product's
 * conversions, but /v1/product-uoms?include=product does. One small
 * request per distinct product, cached for 5 minutes.
 */
export function useProductPackaging(productIds: Array<number | null | undefined>): Map<number, string> {
  const ids = Array.from(new Set(productIds.map(Number).filter((n) => n > 0))).sort((a, b) => a - b)

  const results = useQueries({
    queries: ids.map((pid) => ({
      queryKey: ['product-packaging', pid],
      staleTime: 5 * 60_000,
      queryFn: () =>
        productUomsService
          .list({ per_page: 1, include: 'product', 'filter[product_id]': pid } as any)
          .then((r) => {
            const row = ((r.data as any)?.data ?? [])[0]
            return packagingChains(row?.product?.conversions).join(' · ')
          }),
    })),
  })

  const map = new Map<number, string>()
  ids.forEach((pid, i) => {
    const chain = results[i]?.data
    if (chain) map.set(pid, chain)
  })
  return map
}
