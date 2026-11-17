'use client'

import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { productUomsService } from '@/services/product-uoms.service'
import { convertDown, convertUp, toConversionEntries, type ConversionEntry } from '@/utils/unitDisplay'

type BranchUom = { uomCode: string; conversions: ConversionEntry[] }

/**
 * "Branch Type" unit display, shared by Stock (product inventories) and Stock
 * Movements: for each product pick ONE product-UOM whose branch_types include
 * the active branch's type, and show base-unit quantities in that UOM
 * (e.g. 50.000 GR → 50 KG for a production branch tagged on the KG UOM).
 *
 * The branch-tagged product-UOMs are fetched once per branch type (paged —
 * the API caps per_page at 200) and cached, so both pages share one load.
 * `extraProductUoms` lets a page add product-UOMs it already holds.
 */
export function useBranchUomDisplay(extraProductUoms: any[] = []) {
  const { user } = useAuth()
  const branchType = String((user as any)?.branch?.type ?? '').toLowerCase()

  const { data: branchPuoms = [] } = useQuery({
    queryKey: ['product-uoms', 'branch-type-display', branchType],
    enabled: !!branchType,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const rows: any[] = []
      for (let p = 1; p <= 50; p++) {
        const body = await productUomsService
          .list({
            page: p,
            per_page: 200,
            include: 'product,product.conversions,uom',
            'filter[branch_type]': branchType,
          } as any)
          .then((r) => r.data as any)
        rows.push(...(body?.data ?? []))
        if (p >= Number(body?.meta?.last_page ?? 1)) break
      }
      return rows
    },
  })

  const byProductId = useMemo(() => {
    const map = new Map<number, BranchUom>()
    if (!branchType) return map
    for (const pu of [...branchPuoms, ...extraProductUoms]) {
      const pid = Number(pu?.product_id)
      if (!pid || map.has(pid)) continue
      if (!Array.isArray(pu?.branch_types)) continue
      if (!pu.branch_types.some((bt: string) => String(bt).toLowerCase() === branchType)) continue
      const uomCode = pu.uom?.code ?? ''
      if (!uomCode) continue
      map.set(pid, { uomCode, conversions: toConversionEntries(pu.product?.conversions) })
    }
    return map
  }, [branchPuoms, extraProductUoms, branchType])

  /**
   * Base-unit qty → branch-type UOM. Falls back to the base unit when the
   * product has no branch-tagged UOM or no conversion path. Row conversions
   * win; the ones loaded with the branch product-UOM are the fallback. The
   * branch UOM can sit above or below the base unit, so both directions are
   * tried.
   */
  const toBranchUnit = useCallback(
    (
      baseQty: number,
      baseUomCode: string,
      productId?: number | null,
      rowConversions?: any[] | null,
    ): { qty: number; unit: string } => {
      const target = productId ? byProductId.get(Number(productId)) : undefined
      if (target?.uomCode) {
        const rowConvs = toConversionEntries(rowConversions)
        const convs = rowConvs.length > 0 ? rowConvs : target.conversions
        const converted =
          convertUp(baseQty, baseUomCode, target.uomCode, convs) ??
          convertDown(baseQty, baseUomCode, target.uomCode, convs)
        if (converted !== null) return { qty: converted, unit: target.uomCode }
      }
      return { qty: baseQty, unit: baseUomCode }
    },
    [byProductId],
  )

  return { branchType, toBranchUnit }
}
