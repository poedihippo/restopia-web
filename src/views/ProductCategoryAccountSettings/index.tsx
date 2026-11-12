'use client'
import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { productCategoryAccountSettingsService } from '@/services/product-category-account-settings.service'
import { productCategoriesService } from '@/services/product-categories.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import SearchableSelect from '@/components/SearchableSelect'
import { useInfiniteOptions } from '@/hooks/useInfiniteOptions'
import { useAuth } from '@/hooks/useAuth'
import ProductCategoryAccountSettingSheet from './ProductCategoryAccountSettingSheet'
import { toastMutationApiError } from '@/utils/apiError'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { FilterBar, countActive } from '@/components/ListFilters'
import { formatDate } from '@/utils/date'
import { Plus, Pencil, Trash2, BookOpen, X } from 'lucide-react'

export default function ProductCategoryAccountSettingsView() {
  const qc = useQueryClient()
  const { hasPermission, user } = useAuth()
  const myBranchId = (user as any)?.branch_id ?? (user as any)?.branch?.id
  const canCreate = hasPermission('product-category-account-setting.create')
  const canEdit = hasPermission('product-category-account-setting.update')
  const canDelete = hasPermission('product-category-account-setting.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [categoryFilter, setCategoryFilter] = useState(0)
  const [categoryFilterSearch, setCategoryFilterSearch] = useState('')
  const [debouncedCategoryFilterSearch, setDebouncedCategoryFilterSearch] = useState('')
  const [coaFilter, setCoaFilter] = useState(0)
  const [coaFilterSearch, setCoaFilterSearch] = useState('')
  const [debouncedCoaFilterSearch, setDebouncedCoaFilterSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<any | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, categoryFilter, coaFilter])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCategoryFilterSearch(categoryFilterSearch), 400)
    return () => clearTimeout(t)
  }, [categoryFilterSearch])
  const categoryFilterOpts = useInfiniteOptions<any>({
    queryKey: ['product-categories-all', 'pcas-filter', debouncedCategoryFilterSearch],
    fetchPage: (page) => productCategoriesService.list({ page, per_page: 50, 'filter[search]': debouncedCategoryFilterSearch || undefined } as any).then(r => r.data),
  })
  const categoryFilterOptions = [
    { value: 0, label: 'All Product Categories' },
    ...categoryFilterOpts.items.map((c: any) => ({ value: c.id, label: c.name })),
  ]

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCoaFilterSearch(coaFilterSearch), 400)
    return () => clearTimeout(t)
  }, [coaFilterSearch])
  const { data: coaFilterData, isFetching: coaFilterLoading } = useQuery({
    queryKey: ['chart-of-accounts-all', 'pcas-filter', debouncedCoaFilterSearch],
    queryFn: () => chartOfAccountsService.list({ per_page: 1000, sort: 'code', 'filter[search]': debouncedCoaFilterSearch || undefined } as any).then(r => r.data),
    placeholderData: (prev: any) => prev,
  })
  const coaFilterOptions = [
    { value: 0, label: 'All Accounts' },
    ...((coaFilterData as any)?.data ?? []).map((a: any) => ({ value: a.id, label: `${a.code} – ${a.name}` })),
  ]

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['product-category-account-settings', page, perPage, debouncedSearch, myBranchId, categoryFilter, coaFilter],
    queryFn: () =>
      productCategoryAccountSettingsService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'product_category,chart_of_account',
          'filter[search]': debouncedSearch || undefined,
          'filter[branch_id]': myBranchId || undefined,
          'filter[product_category_id]': categoryFilter || undefined,
          'filter[chart_of_account_id]': coaFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productCategoryAccountSettingsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['product-category-account-settings'] })
      toast.success('Account setting deleted')
      setDeleteConfirmId(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete account setting'),
  })

  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
  const actionBtnStyle: React.CSSProperties = { padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            Product Category Account Settings
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Map product categories to inventory asset accounts
          </p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditData(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={15} />New Setting
          </button>
        )}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search settings..."
        activeCount={countActive(categoryFilter, coaFilter)}
        onClear={() => { setCategoryFilter(0); setCoaFilter(0); setPage(1) }}
        quick={
          <>
            <div style={{ minWidth: 220 }}>
              <SearchableSelect
                value={categoryFilter}
                onChange={(val) => setCategoryFilter(Number(val) || 0)}
                options={categoryFilterOptions}
                placeholder="All Product Categories"
                searchPlaceholder="Search category..."
                triggerStyle={{ height: 36, padding: '0 10px', fontSize: 13 }}
                loading={categoryFilterOpts.loading}
                {...categoryFilterOpts.selectProps}
                onSearchChange={setCategoryFilterSearch}
              />
            </div>
            <div style={{ minWidth: 240 }}>
              <SearchableSelect
                value={coaFilter}
                onChange={(val) => setCoaFilter(Number(val) || 0)}
                options={coaFilterOptions}
                placeholder="All Accounts"
                searchPlaceholder="Search account..."
                triggerStyle={{ height: 36, padding: '0 10px', fontSize: 13 }}
                loading={coaFilterLoading}
                onSearchChange={setCoaFilterSearch}
              />
            </div>
          </>
        }
      />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Product Category</th>
              <th style={thStyle}>Chart of Account</th>
              <th style={{ ...thStyle, width: 180 }}>COA Code</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, width: 120 }}>Created</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 6 ? 60 : '75%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}><span style={{ fontSize: 14, color: 'var(--destructive)' }}>Failed to load settings.</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <BookOpen size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No product category account settings found</span>
                </div>
              </td></tr>
            ) : (
              items.map((item: any, idx: number) => (
                <tr key={item.id} style={{ transition: 'background 120ms' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>{(page - 1) * perPage + idx + 1}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.product_category?.name || '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    {item.chart_of_account ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.chart_of_account.name}</span>
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{item.chart_of_account.code}</span>
                      </div>
                    ) : <span style={{ fontSize: 13, color: 'var(--foreground-muted)', fontStyle: 'italic' }}>Not set</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground-muted)' }}>{item.chart_of_account?.code || '—'}</span>
                  </td>
                  <td style={{ ...tdStyle, fontSize: 13, color: 'var(--foreground-muted)' }}>{item.description || '—'}</td>
                  <td style={tdStyle}>
                    <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.created_at ? formatDate(item.created_at) : '—'}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      {canEdit && (
                        <button onClick={() => { setEditData(item); setSheetOpen(true) }} style={actionBtnStyle} title="Edit">
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteConfirmId(item.id)} style={{ ...actionBtnStyle, color: 'var(--destructive)' }} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 380, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Setting</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>This will remove the account mapping for this product category.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <ProductCategoryAccountSettingSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setTimeout(() => setEditData(null), 200) }}
        editData={editData}
      />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
