'use client'

import React, { useState } from 'react'
import { Plus, Search, Trash, FileText } from 'lucide-react'
import { priceListsService } from '@/services/price-lists.service'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import PriceListItemSheet from './PriceListItemSheet'
import { useDebounce } from '@/hooks/useDebounce'
import { toast } from 'sonner'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/router'
import BackLink from '@/components/BackLink'
import { formatCurrency } from '@/utils/price'
import { getProductUomName } from '@/utils/productUomName'

export default function PriceListItemsView() {
  const router = useRouter()
  const { id } = router.query
  const priceListId = Number(id)

  const { hasPermission } = useAuth()
  const canCreate = hasPermission('price_list.create')
  const canUpdate = hasPermission('price_list.update')
  const canDelete = hasPermission('price_list.delete')
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 500)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<{ id: number; product_uom_id: number; base_price: number; online_price: number; franchise_price: number } | null>(null)
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const { data: priceListData } = useQuery({
    queryKey: ['price-list', priceListId],
    queryFn: () => priceListsService.findById(priceListId),
    enabled: !!priceListId
  })

  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: ['price-list-items', priceListId, page, debouncedSearch],
    queryFn: () => {
      const params: any = { page, include: 'product_uom' }
      if (debouncedSearch && debouncedSearch.trim()) params['filter[search]'] = debouncedSearch.trim()
      return priceListsService.listItems(priceListId, params)
    },
    enabled: !!priceListId
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const deleteMutation = useMutation({
    mutationFn: (itemId: number) => priceListsService.deleteItem(priceListId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-list-items', priceListId] })
      toast.success('Price List Item deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) =>
      toastMutationApiError(err, 'Failed to delete price list item'),
  })

  const items = (data as any)?.data?.data ?? []
  const itemsMeta = (data as any)?.data?.meta
  const canReadFranchisePrice = hasPermission('common.franchise-price.read')

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <BackLink href="/products/price-lists" label="Price Lists" style={{ marginBottom: -12 }} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <h1 className="text-xl sm:text-2xl font-bold">
          {priceListData?.data?.data?.name ? `${priceListData.data.data.name} - Items` : 'Price List Items'}
        </h1>
        <div style={{ flex: 1 }} />
        {canCreate && (
          <button
            onClick={() => {
              setEditData(null)
              setSheetOpen(true)
            }}
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
            Add Item
          </button>
        )}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
          <div style={{ position: 'relative', width: 300 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--foreground-muted)' }} />
            <input
              placeholder="Search items..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 14,
                background: 'var(--surface)',
                color: 'var(--foreground)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground-muted)', width: 50, textAlign: 'center' }}>No.</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground-muted)' }}>Product UOM</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground-muted)' }}>Offline Price</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground-muted)' }}>Online Price</th>
                {canReadFranchisePrice && (
                  <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground-muted)' }}>Franchise Price</th>
                )}
                <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--foreground-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={canReadFranchisePrice ? 6 : 5} style={{ padding: 32, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={canReadFranchisePrice ? 6 : 5} style={{ padding: 32, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                    No items found
                  </td>
                </tr>
              ) : (
                items.map((item: any, idx: number) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--foreground-muted)' }}>
                      {(page - 1) * (itemsMeta?.per_page ?? items.length) + idx + 1}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--foreground)' }}>
                      {(() => {
                        const pu = item.product_uom
                        const label = pu
                          ? `${getProductUomName(pu, pu.product?.name) || 'Unknown'} — ${pu.uom?.name ?? pu.uom?.code ?? ''}`.trim()
                          : '-'
                        return label
                      })()}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--foreground)' }}>
                      {formatCurrency(item.base_price)}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--foreground)' }}>
                      {formatCurrency(item.online_price)}
                    </td>
                    {canReadFranchisePrice && (
                      <td style={{ padding: '12px 16px', color: 'var(--foreground)' }}>
                        {formatCurrency(item.franchise_price)}
                      </td>
                    )}
                    <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                      {canUpdate && (
                        <button
                          onClick={() => {
                            setEditData({ 
                              id: item.id, 
                              product_uom_id: item.product_uom_id, 
                              base_price: item.base_price, 
                              online_price: item.online_price, 
                              franchise_price: item.franchise_price 
                            })
                            setSheetOpen(true)
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--foreground-muted)' }}
                        >
                          <FileText size={16} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteConfirmId(item.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--destructive)' }}
                        >
                          <Trash size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PriceListItemSheet
        priceListId={priceListId}
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditData(null)
        }}
        editData={editData}
      />
    </div>
  )
}
