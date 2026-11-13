'use client'
import { formatDate, toInputDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { periodsService, fiscalYearsService, type PeriodRequest } from '@/services/accounting.service'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { periodEditBlock, blockedStyle } from '@/lib/actionGuards'
import { CustomPagination } from '@/components/ui/CustomPagination'
import { ActiveSegment, FilterBar, FilterSelect, countActive } from '@/components/ListFilters'
import SearchableSelect from '@/components/SearchableSelect'
import { Controller } from 'react-hook-form'
import {
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  X, Loader2, Calendar, CheckCircle2, Lock, LockOpen, Download,
} from 'lucide-react'

interface Period {
  id: number
  name: string
  fiscal_year_id: number
  start_date: string
  end_date: string
  is_active: boolean
  is_closed: boolean
  fiscal_year?: { id: number; name: string }
  created_at?: string
}

interface FiscalYear { id: number; name: string }

const schema = z.object({
  fiscal_year_id: z.coerce.number().min(1, 'Fiscal year is required'),
  name: z.string().min(1, 'Name is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  is_active: z.boolean().default(true),
})
type FormValues = z.infer<typeof schema>

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--foreground)',
  background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}
const inputError: React.CSSProperties = { ...inputStyle, border: '1px solid var(--destructive)' }
const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
  color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const fmtDate = (d: string) => formatDate(d)

export default function PeriodsView() {
  const queryClient = useQueryClient()
  const { isSuperadmin, hasPermission } = useAuth()
  const canCreate = isSuperadmin || hasPermission('period.create')
  const canUpdate = isSuperadmin || hasPermission('period.update')
  const canDelete = isSuperadmin || hasPermission('period.delete')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fiscalYearFilter, setFiscalYearFilter] = useState('')
  // Default All: is_active marks the current period/year (1 of N), so Active would hide history.
  const [activeFilter, setActiveFilter] = useState('')
  const [closedFilter, setClosedFilter] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Period | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [lockTarget, setLockTarget] = useState<{ period: Period; action: 'close' | 'reopen' } | null>(null)
  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')

  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: ['periods', page, perPage, debouncedSearch, fiscalYearFilter, activeFilter, closedFilter],
    queryFn: () => periodsService.list({
      page, per_page: perPage, sort: '-id', include: 'fiscal_year',
      'filter[search]': debouncedSearch || undefined,
      'filter[fiscal_year_id]': fiscalYearFilter || undefined,
      'filter[is_active]': activeFilter || undefined,
      'filter[is_closed]': closedFilter || undefined,
    } as any).then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const { data: fiscalData } = useQuery({
    queryKey: ['fiscal-years-all', debouncedDropdownSearch],
    queryFn: () => fiscalYearsService.list({ per_page: 1000, sort: '-id', 'filter[search]': debouncedDropdownSearch || undefined }).then((r) => r.data),
  })

  const items: Period[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const fiscalYears: FiscalYear[] = (fiscalData as any)?.data ?? []

  // Filter dropdown: full fiscal-year list (independent of the sheet's dropdown search).
  const { data: filterFiscalData } = useQuery({
    queryKey: ['fiscal-years-all', ''],
    queryFn: () => fiscalYearsService.list({ per_page: 1000, sort: '-id' } as any).then((r) => r.data),
  })
  const filterFiscalYears: FiscalYear[] = (filterFiscalData as any)?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => periodsService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['periods'] }); toast.success('Period deleted'); setDeleteConfirmId(null) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { fiscal_year_id: 0, name: '', start_date: '', end_date: '', is_active: true },
  })

  useEffect(() => {
    if (editData) reset({ fiscal_year_id: editData.fiscal_year_id, name: editData.name, start_date: toInputDate(editData.start_date), end_date: toInputDate(editData.end_date), is_active: editData.is_active ?? true })
    else reset({ fiscal_year_id: 0, name: '', start_date: '', end_date: '', is_active: true })
  }, [editData, reset])

  const lockMutation = useMutation({
    mutationFn: ({ period, action }: { period: Period; action: 'close' | 'reopen' }) =>
      action === 'close' ? periodsService.close(period.id) : periodsService.reopen(period.id),
    onSuccess: (_res, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['periods'] })
      queryClient.invalidateQueries({ queryKey: ['periods-all'] })
      toast.success(action === 'close' ? 'Period closed' : 'Period reopened')
      setLockTarget(null)
    },
    onError: (err: any, { action }) =>
      toastMutationApiError(err, action === 'close' ? 'Failed to close period' : 'Failed to reopen period'),
  })

  const createMutation = useMutation({
    mutationFn: (data: PeriodRequest) => periodsService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['periods'] }); toast.success('Period created'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PeriodRequest>) => periodsService.update(editData!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['periods'] }); toast.success('Period updated'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const onSubmit = (values: FormValues) => {
    // is_closed is never sent on update; create always opens the period.
    // Closing / reopening goes through the lock actions.
    if (editData) updateMutation.mutate(values as Partial<PeriodRequest>)
    else createMutation.mutate({ ...values, is_closed: false } as PeriodRequest)
  }

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportPeriods(),
    onSuccess: (res) => { downloadFileFromResponse(res, 'periods.xlsx') },
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Accounting Periods</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Month or quarter within a fiscal year for journal entries</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => exportExcel()} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.6 : 1 }}>
            <Download size={14} /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          {canCreate && (
            <button onClick={() => { setEditData(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={16} /> New Period
            </button>
          )}
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search periods..."
        activeCount={countActive(fiscalYearFilter, activeFilter, closedFilter)}
        onClear={() => { setFiscalYearFilter(''); setActiveFilter(''); setClosedFilter(''); setPage(1) }}
        quick={
          <>
            <ActiveSegment value={activeFilter} onChange={(v) => { setActiveFilter(v); setPage(1) }} active="1" inactive="0" label="Period status" />
            <FilterSelect value={fiscalYearFilter} onChange={(e) => { setFiscalYearFilter(e.target.value); setPage(1) }} style={{ maxWidth: 220 }}>
              <option value="">All Fiscal Years</option>
              {filterFiscalYears.map((f) => <option key={f.id} value={String(f.id)}>{f.name}</option>)}
            </FilterSelect>
            <FilterSelect value={closedFilter} onChange={(e) => { setClosedFilter(e.target.value); setPage(1) }}>
              <option value="">Closed: All</option>
              <option value="1">Closed: Yes</option>
              <option value="0">Closed: No</option>
            </FilterSelect>
          </>
        }
      />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Name</th>
              <th style={{ ...thStyle, width: 180 }}>Fiscal Years</th>
              <th style={{ ...thStyle, width: 140 }}>Start Date</th>
              <th style={{ ...thStyle, width: 140 }}>End Date</th>
              <th style={{ ...thStyle, width: 100 }}>Status</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} style={tdStyle}><div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 6 ? 40 : '80%', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                ))}</tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <Calendar size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No periods found</span>
                </div>
              </td></tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id} style={{ transition: 'background 120ms' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.name}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.fiscal_year?.name || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.start_date ? fmtDate(item.start_date) : '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.end_date ? fmtDate(item.end_date) : '—'}</span></td>
                  <td style={tdStyle}>
                    {item.is_closed
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--foreground-muted)', padding: '2px 8px', borderRadius: 99, background: 'var(--background)', border: '1px solid var(--border)' }}><Lock size={11} /> Closed</span>
                      : item.is_active
                        ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981', padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.1)' }}><CheckCircle2 size={11} /> Active</span>
                        : <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Inactive</span>
                    }
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {canUpdate && (
                        item.is_closed
                          ? <button title="Reopen period" onClick={() => setLockTarget({ period: item, action: 'reopen' })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><LockOpen size={14} /></button>
                          : <button title="Close period" onClick={() => setLockTarget({ period: item, action: 'close' })} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><Lock size={14} /></button>
                      )}
                      {(() => {
                        const reason = periodEditBlock(item)
                        return (
                          <>
                            {canUpdate && <button onClick={() => { if (!reason) { setEditData(item); setSheetOpen(true) } }} disabled={!!reason} title={reason ?? 'Edit'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex', ...(reason ? blockedStyle : {}) }}><Pencil size={14} /></button>}
                            {canDelete && <button onClick={() => { if (!reason) setDeleteConfirmId(item.id) }} disabled={!!reason} title={reason ?? 'Delete'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--destructive)', display: 'flex', ...(reason ? blockedStyle : {}) }}><Trash2 size={14} /></button>}
                          </>
                        )
                      })()}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {lockTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setLockTarget(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 400, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
              {lockTarget.action === 'close' ? 'Close' : 'Reopen'} {lockTarget.period.name}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px', lineHeight: 1.5 }}>
              {lockTarget.action === 'close'
                ? 'No journals can be written into this period after it is closed; later corrections go into an open period. Every journal in it must already be posted.'
                : 'Journals can be written into this period again until it is closed.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setLockTarget(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => lockMutation.mutate(lockTarget)} disabled={lockMutation.isPending} style={{ padding: '7px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: lockMutation.isPending ? 0.7 : 1 }}>
                {lockTarget.action === 'close' ? 'Close period' : 'Reopen period'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 360, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Period</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>This will delete the period and may affect related journals.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSheetOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 50, width: 460, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>{editData ? 'Edit Period' : 'New Period'}</h2>
              <button onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Fiscal Years <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <Controller
                  control={control}
                  name="fiscal_year_id"
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ? Number(field.value) : 0}
                      onChange={(val) => field.onChange(Number(val) || 0)}
                      options={fiscalYears.map((fy) => ({ value: fy.id, label: fy.name }))}
                      placeholder="-- Select Fiscal Year --"
                      searchPlaceholder="Search fiscal year..."
                      error={errors.fiscal_year_id?.message}
                      onSearchChange={setDropdownSearch}
                    />
                  )}
                />
                {errors.fiscal_year_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.fiscal_year_id.message}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Name Periode <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <input {...register('name')} placeholder="e.g. Januari 2025, Q1 2025" style={errors.name ? inputError : inputStyle} />
                {errors.name && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.name.message}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Date Start Date <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <input type="date" {...register('start_date')} style={errors.start_date ? inputError : inputStyle} />
                  {errors.start_date && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.start_date.message}</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Date End Date <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <input type="date" {...register('end_date')} style={errors.end_date ? inputError : inputStyle} />
                  {errors.end_date && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.end_date.message}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--foreground)' }}>
                  <input type="checkbox" {...register('is_active')} style={{ width: 16, height: 16, accentColor: 'var(--accent)' }} />
                  Active
                </label>
              </div>
            </form>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheetOpen(false)} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={isPending} onClick={handleSubmit(onSubmit)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.7 : 1 }}>
                {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {editData ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
