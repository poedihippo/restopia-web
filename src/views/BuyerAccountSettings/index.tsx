'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { buyerAccountSettingsService } from '@/services/buyer-account-settings.service'
import { buyersService } from '@/services/buyers.service'
import { accountSettingsService } from '@/services/account-settings.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import SearchableSelect from '@/components/SearchableSelect'
import { useAuth } from '@/hooks/useAuth'
import BuyerAccountSettingSheet from './BuyerAccountSettingSheet'
import { toastMutationApiError } from '@/utils/apiError'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { FilterBar, FilterSelect, countActive } from '@/components/ListFilters'
import { formatDate } from '@/utils/date'
import { Plus, Pencil, Trash2, UserRound } from 'lucide-react'

export default function BuyerAccountSettingsView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('buyer-account-setting.create')
  const canEdit = hasPermission('buyer-account-setting.update')
  const canDelete = hasPermission('buyer-account-setting.delete')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [buyerFilter, setBuyerFilter] = useState<number | ''>('')
  const [keyFilter, setKeyFilter] = useState<number | ''>('')
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

  useEffect(() => { setPage(1) }, [debouncedSearch, buyerFilter, keyFilter, coaFilter])

  // Account setting keys (derived from the account-settings list, same as the sheet).
  const { data: keyOptionsData } = useQuery({
    queryKey: ['account-settings', 'key-options'],
    queryFn: () => accountSettingsService.list({ per_page: 100, include: 'account_setting_key' } as any).then(r => r.data),
  })
  const keyOptions = useMemo(() => {
    const map = new Map<number, { id: number; key: string; label?: string }>()
    for (const s of ((keyOptionsData as any)?.data ?? []) as any[]) {
      const e = s.account_setting_key_entity
      if (e && !map.has(e.id)) map.set(e.id, { id: e.id, key: e.key, label: e.label })
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
  }, [keyOptionsData])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCoaFilterSearch(coaFilterSearch), 400)
    return () => clearTimeout(t)
  }, [coaFilterSearch])
  const { data: coaFilterData, isFetching: coaFilterLoading } = useQuery({
    queryKey: ['chart-of-accounts-all', 'buyer-filter', debouncedCoaFilterSearch],
    queryFn: () => chartOfAccountsService.list({ per_page: 1000, sort: 'code', 'filter[search]': debouncedCoaFilterSearch || undefined } as any).then(r => r.data),
    placeholderData: (prev: any) => prev,
  })
  const coaFilterOptions = [
    { value: 0, label: 'All Accounts' },
    ...((coaFilterData as any)?.data ?? []).map((a: any) => ({ value: a.id, label: `${a.code} – ${a.name}` })),
  ]

  const { data: buyersData } = useQuery({
    queryKey: ['buyers-all'],
    queryFn: () => buyersService.list({ per_page: 1000, sort: 'name' } as any).then(r => r.data),
  })
  const allBuyers: any[] = (buyersData as any)?.data ?? []

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['buyer-account-settings', page, perPage, debouncedSearch, buyerFilter, keyFilter, coaFilter],
    queryFn: () =>
      buyerAccountSettingsService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'buyer,chart_of_account,account_setting_key',
          'filter[search]': debouncedSearch || undefined,
          'filter[buyer_id]': buyerFilter || undefined,
          'filter[account_setting_key_id]': keyFilter || undefined,
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
    mutationFn: (id: number) => buyerAccountSettingsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['buyer-account-settings'] })
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
            Buyer Account Settings
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Configure per-buyer journal account overrides
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
        activeCount={countActive(buyerFilter, keyFilter, coaFilter)}
        onClear={() => { setBuyerFilter(''); setKeyFilter(''); setCoaFilter(0); setPage(1) }}
        quick={
          <>
            <FilterSelect value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value ? Number(e.target.value) : '')} style={{ minWidth: 200 }}>
              <option value="">All Buyers</option>
              {allBuyers.map((b: any) => (
                <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={keyFilter} onChange={(e) => setKeyFilter(e.target.value ? Number(e.target.value) : '')} style={{ maxWidth: 240 }}>
              <option value="">All Account Keys</option>
              {keyOptions.map((k) => (
                <option key={k.id} value={k.id}>{k.label || k.key}</option>
              ))}
            </FilterSelect>
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
              <th style={thStyle}>Buyer</th>
              <th style={thStyle}>Account Key</th>
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
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 7 ? 60 : '75%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : isError ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}><span style={{ fontSize: 14, color: 'var(--destructive)' }}>Failed to load settings.</span></td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <UserRound size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No buyer account settings found</span>
                </div>
              </td></tr>
            ) : (
              items.map((item: any, idx: number) => {
                const keyInfo = item.account_setting_key_entity
                return (
                  <tr key={item.id} style={{ transition: 'background 120ms' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>{(page - 1) * perPage + idx + 1}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.buyer?.name || '—'}</span>
                        <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{item.buyer?.code || ''}</span>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{keyInfo?.label || item.account_setting_key || `Key #${item.account_setting_key_id}`}</span>
                        <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontFamily: 'monospace' }}>{keyInfo?.key || item.account_setting_key || ''}</span>
                      </div>
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
                )
              })
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
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>This will remove the account mapping for this buyer.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <BuyerAccountSettingSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setTimeout(() => setEditData(null), 200) }}
        editData={editData}
      />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}
