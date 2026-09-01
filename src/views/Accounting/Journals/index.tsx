'use client'
import { formatDate, toInputDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  journalsService, periodsService, chartOfAccountsService,
  type JournalRequest,
} from '@/services/accounting.service'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import SearchableSelect from '@/components/SearchableSelect'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight,
  X, Loader2, FileText, CheckCircle2, Send, AlertCircle, Eye, Download,
} from 'lucide-react'
//trigger
interface JournalDetail {
  id?: number
  chart_of_account_id: number
  chart_of_account?: { id: number; name: string; code: string }
  debit: number
  credit: number
  description?: string
}

interface Journal {
  id: number
  journal_number: string
  date: string
  type: string
  description?: string
  is_posted: boolean
  is_reversed: boolean
  period_id: number
  period?: { id: number; name: string }
  journal_details?: JournalDetail[]
  created_at?: string
}

interface Period { id: number; name: string }
interface CoA { id: number; code: string; name: string }

const detailSchema = z.object({
  id: z.number().optional(),
  chart_of_account_id: z.coerce.number().min(1, 'Account is required'),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
  description: z.string().optional(),
})

const schema = z.object({
  period_id: z.coerce.number().min(1, 'Period is required'),
  date: z.string().min(1, 'Date is required'),
  type: z.enum(['manual', 'sales', 'purchase', 'receipt', 'payment', 'adjustment', 'closing']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(2, 'Minimum 2 journal lines'),
})
type FormValues = z.infer<typeof schema>

const JOURNAL_TYPE_LABELS: Record<string, string> = {
  manual: 'Manual',
  sales: 'Sales',
  purchase: 'Purchase',
  receipt: 'Receipt',
  payment: 'Payment',
  adjustment: 'Adjustment',
  closing: 'Closing',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--foreground)',
  background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}
const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
  color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const fmtDate = (d: string) => formatDate(d)
const fmtCurrency = (n: number) => new Intl.NumberFormat('id-ID').format(n)

export default function JournalsView() {

  const [dropdownSearch, setDropdownSearch] = useState('')
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch])
  const queryClient = useQueryClient()
  const { isSuperadmin, hasPermission } = useAuth()
  const canCreate = isSuperadmin || hasPermission('journal.create')
  const canUpdate = isSuperadmin || hasPermission('journal.update')
  const canDelete = isSuperadmin || hasPermission('journal.delete')
  const canPost = isSuperadmin || hasPermission('journal.update')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Journal | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [detailItem, setDetailItem] = useState<Journal | null>(null)
  const [coaSearch, setCoaSearch] = useState('')
  const [debouncedCoaSearch, setDebouncedCoaSearch] = useState('')

  useEffect(() => { const t = setTimeout(() => setDebouncedCoaSearch(coaSearch), 400); return () => clearTimeout(t) }, [coaSearch])

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch, typeFilter])

  const { data, isLoading } = useQuery({
    queryKey: ['journals', page, perPage, debouncedSearch, typeFilter],
    queryFn: () => journalsService.list({ page, per_page: perPage, sort: '-id', include: 'period,journal_details', 'filter[search]': debouncedSearch || undefined, 'filter[type]': typeFilter || undefined }).then((r) => r.data),
  })

  const { data: periodsData } = useQuery({
    queryKey: ['periods-all', debouncedDropdownSearch],
    queryFn: () => periodsService.list({ 'filter[search]': debouncedDropdownSearch || undefined,  per_page: perPage, sort: '-id' }).then((r) => r.data),
  })

  const { data: coaData } = useQuery({
    queryKey: ['chart-of-accounts-all', debouncedCoaSearch, debouncedDropdownSearch],
    queryFn: () => chartOfAccountsService.list({ per_page: 1000, sort: 'code', 'filter[is_active]': 'true', 'filter[search]': debouncedCoaSearch || undefined } as any).then((r) => r.data),
  })

  const items: Journal[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const periods: Period[] = (periodsData as any)?.data ?? []
  const accounts: CoA[] = (coaData as any)?.data ?? []
  const periodOptions = periods.map((p) => ({ value: String(p.id), label: p.name }))
  const accountOptions = accounts.map((a) => ({ value: String(a.id), label: `${a.code} ${a.name}` }))

  const deleteMutation = useMutation({
    mutationFn: (id: number) => journalsService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Journal deleted'); setDeleteConfirmId(null) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const postMutation = useMutation({
    mutationFn: (id: number) => journalsService.post(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Journal posted') },
    onError: (err: any) => toastMutationApiError(err, 'Failed to post journal'),
  })

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      period_id: 0, date: '', type: 'manual', description: '',
      details: [
        { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
        { chart_of_account_id: 0, debit: 0, credit: 0, description: '' },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'details' })
  const watchedDetails = watch('details')

  const totalDebit = watchedDetails?.reduce((s, d) => s + (Number(d.debit) || 0), 0) ?? 0
  const totalCredit = watchedDetails?.reduce((s, d) => s + (Number(d.credit) || 0), 0) ?? 0
  const isBalanced = totalDebit === totalCredit && totalDebit > 0

  useEffect(() => {
    if (editData) {
      reset({
        period_id: editData.period_id,
        date: toInputDate(editData.date),
        type: editData.type as any,
        description: editData.description ?? '',
        details: editData.journal_details?.length
          ? editData.journal_details.map((d) => ({ id: d.id, chart_of_account_id: d.chart_of_account_id, debit: d.debit, credit: d.credit, description: d.description ?? '' }))
          : [{ chart_of_account_id: 0, debit: 0, credit: 0, description: '' }, { chart_of_account_id: 0, debit: 0, credit: 0, description: '' }],
      })
    } else {
      reset({ period_id: 0, date: '', type: 'manual', description: '', details: [{ chart_of_account_id: 0, debit: 0, credit: 0, description: '' }, { chart_of_account_id: 0, debit: 0, credit: 0, description: '' }] })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: JournalRequest) => journalsService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Journal created'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: JournalRequest) => journalsService.update(editData!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Journal updated'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: FormValues) => {
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [debouncedDropdownSearch, setDebouncedDropdownSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebouncedDropdownSearch(dropdownSearch), 400); return () => clearTimeout(t) }, [dropdownSearch]);

    const payload: JournalRequest = {
      period_id: values.period_id,
      date: values.date,
      type: values.type,
      description: values.description,
      details: values.details.map((d) => ({ id: d.id, chart_of_account_id: d.chart_of_account_id, debit: Number(d.debit), credit: Number(d.credit), description: d.description })),
    }
    if (editData) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const numInputStyle: React.CSSProperties = { ...inputStyle, textAlign: 'right' }
  const smallInputStyle: React.CSSProperties = { ...inputStyle, padding: '7px 10px', fontSize: 13 }

  // Detail modal: fetch the journal by id for its lines — the list query is kept light and doesn't include them.
  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['journal-detail', detailItem?.id],
    enabled: !!detailItem?.id,
    queryFn: () =>
      journalsService
        .findById(detailItem!.id, { include: 'period,journal_details,journal_details.chart_of_account' })
        .then((r) => r.data),
  })
  const fetchedJournal: Journal | undefined = (detailData as any)?.data ?? (detailData as any)

  // Detail modal: debit/credit lines, standard journal presentation (debits first, then credits).
  const detailLines = fetchedJournal?.journal_details ?? []
  const sortedDetailLines = [...detailLines].sort((a, b) => {
    const aIsDebit = Number(a.debit) > 0 ? 0 : 1
    const bIsDebit = Number(b.debit) > 0 ? 0 : 1
    return aIsDebit - bIsDebit
  })
  const detailTotalDebit = detailLines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const detailTotalCredit = detailLines.reduce((s, l) => s + Number(l.credit || 0), 0)
  const detailIsBalanced = detailTotalDebit === detailTotalCredit

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportJournalEntries(),
    onSuccess: (res) => { downloadFileFromResponse(res, 'journal-entries.xlsx') },
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Journals</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Accounting journal entries with double-entry method (debit = credit)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => exportExcel()} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.6 : 1 }}>
            <Download size={14} /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          {canCreate && (
            <button onClick={() => { setEditData(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={16} /> New Journal Entry
            </button>
          )}
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search journal number or description..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)', background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }} />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: 160, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)', background: 'var(--surface)', outline: 'none' }}
        >
          <option value="">All Types</option>
          {Object.entries(JOURNAL_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={{ ...thStyle, width: 140 }}>Journal No.</th>
              <th style={{ ...thStyle, width: 130 }}>Date</th>
              <th style={{ ...thStyle, width: 130 }}>Type</th>
              <th style={thStyle}>Description</th>
              <th style={{ ...thStyle, width: 110 }}>Periode</th>
              <th style={{ ...thStyle, width: 90 }}>Status</th>
              <th style={{ ...thStyle, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} style={tdStyle}><div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 7 ? 60 : '80%', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                ))}</tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={8} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <FileText size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No journals found</span>
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
                  <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground-muted)' }}>{item.journal_number}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.date ? fmtDate(item.date) : '—'}</span></td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                      {JOURNAL_TYPE_LABELS[item.type] ?? item.type}
                    </span>
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.description || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.period?.name || '—'}</span></td>
                  <td style={tdStyle}>
                    {item.is_posted
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981', padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.1)' }}><CheckCircle2 size={11} /> Posted</span>
                      : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f59e0b', padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.1)' }}><AlertCircle size={11} /> Draft</span>
                    }
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => setDetailItem(item)} title="View Detail"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><Eye size={14} /></button>
                      {!item.is_posted && (
                        <>
                          {canPost && <button onClick={() => postMutation.mutate(item.id)} disabled={postMutation.isPending} title="Post Journal"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: '#10b981', display: 'flex' }}><Send size={13} /></button>}
                          {canUpdate && <button onClick={() => { setEditData(item); setSheetOpen(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><Pencil size={14} /></button>}
                          {canDelete && <button onClick={() => setDeleteConfirmId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--destructive)', display: 'flex' }}><Trash2 size={14} /></button>}
                        </>
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
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 360, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Journal</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>Only draft journals can be deleted.</p>
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
          <div style={{ position: 'relative', zIndex: 50, width: 680, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>{editData ? 'Edit Journal' : 'New Journal Entry'}</h2>
              <button onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Periode <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <Controller
                    control={control}
                    name="period_id"
                    render={({ field }) => (
                      <SearchableSelect
                        value={String(field.value ?? 0)}
                        onChange={(val) => field.onChange(Number(val))}
                        options={periodOptions}
                        placeholder="-- Pilih Periode --"
                        searchPlaceholder="Cari periode..."
                        onSearchChange={setDropdownSearch}
/>
                    )}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Date <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <input type="date" {...register('date')} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Journal Type</label>
                  <select {...register('type')} style={inputStyle}>
                    <option value="manual">General</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="closing">Closing</option>
                    <option value="payment">Payment</option>
                    <option value="purchase">Purchase</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Description</label>
                  <input {...register('description')} placeholder="Journal description" style={inputStyle} />
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Journal Lines</label>
                  <button type="button" onClick={() => append({ chart_of_account_id: 0, debit: 0, credit: 0, description: '' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, cursor: 'pointer' }}>
                    <Plus size={12} /> Add Line
                  </button>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--background)' }}>
                        <th style={{ ...thStyle, fontSize: 11 }}>Account</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 110, textAlign: 'right' }}>Debit (Rp)</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 110, textAlign: 'right' }}>Credit (Rp)</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 130 }}>Description</th>
                        <th style={{ ...thStyle, width: 36 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, idx) => {
                        const currentDebit = Number(watchedDetails?.[idx]?.debit) || 0;
                        const currentCredit = Number(watchedDetails?.[idx]?.credit) || 0;
                        return (
                          <tr key={field.id}>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                              <Controller
                                control={control}
                                name={`details.${idx}.chart_of_account_id`}
                                render={({ field }) => (
                                  <SearchableSelect
                                    value={String(field.value ?? 0)}
                                    onChange={(val) => field.onChange(Number(val))}
                                    options={accountOptions}
                                    placeholder="-- Pilih Akun --"
                                    searchPlaceholder="Cari akun..."
                                    onSearchChange={setCoaSearch}
                                  />
                                )}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                              <Controller
                                control={control}
                                name={`details.${idx}.debit`}
                                render={({ field }) => (
                                  <input
                                    type="text"
                                    disabled={currentCredit > 0}
                                    value={field.value ? Number(field.value).toLocaleString('id-ID') : ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '')
                                      field.onChange(val ? Number(val) : 0)
                                    }}
                                    style={{ ...smallInputStyle, textAlign: 'right', fontSize: 12, opacity: currentCredit > 0 ? 0.5 : 1, cursor: currentCredit > 0 ? 'not-allowed' : 'text' }}
                                    placeholder="0"
                                  />
                                )}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                              <Controller
                                control={control}
                                name={`details.${idx}.credit`}
                                render={({ field }) => (
                                  <input
                                    type="text"
                                    disabled={currentDebit > 0}
                                    value={field.value ? Number(field.value).toLocaleString('id-ID') : ''}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, '')
                                      field.onChange(val ? Number(val) : 0)
                                    }}
                                    style={{ ...smallInputStyle, textAlign: 'right', fontSize: 12, opacity: currentDebit > 0 ? 0.5 : 1, cursor: currentDebit > 0 ? 'not-allowed' : 'text' }}
                                    placeholder="0"
                                  />
                                )}
                              />
                            </td>
                            <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                              <input {...register(`details.${idx}.description`)} style={{ ...smallInputStyle, fontSize: 12 }} placeholder="Opsional" />
                            </td>
                            <td style={{ padding: '6px 4px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                              {fields.length > 2 && (
                                <button type="button" onClick={() => remove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--destructive)', display: 'flex' }}><X size={14} /></button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--background)' }}>
                        <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600 }}>Total</td>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--foreground)' }}>{fmtCurrency(totalDebit)}</td>
                        <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, textAlign: 'right', color: 'var(--foreground)' }}>{fmtCurrency(totalCredit)}</td>
                        <td colSpan={2} style={{ padding: '8px 10px' }}>
                          {totalDebit > 0 && (
                            isBalanced
                              ? <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={11} /> Seimbang</span>
                              : <span style={{ fontSize: 11, color: 'var(--destructive)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertCircle size={11} /> Tidak seimbang</span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {(errors.details as any)?.message && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{(errors.details as any).message}</span>}
              </div>
            </form>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSheetOpen(false)} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button type="button" disabled={isPending} onClick={handleSubmit(onSubmit)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.7 : 1 }}>
                {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {editData ? 'Save' : 'Create Journal (Draft)'}
              </button>
            </div>
          </div>
        </div>
      )}
      {detailItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDetailItem(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 640, maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>
                  {detailItem.journal_number}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
                  {detailItem.date ? fmtDate(detailItem.date) : '—'} · {JOURNAL_TYPE_LABELS[detailItem.type] ?? detailItem.type} · {detailItem.period?.name || '—'}
                </p>
              </div>
              <button onClick={() => setDetailItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 20px' }}>
              {detailItem.is_posted
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10b981', padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.1)' }}><CheckCircle2 size={11} /> Posted</span>
                : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f59e0b', padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.1)' }}><AlertCircle size={11} /> Draft</span>
              }
              {detailItem.description && (
                <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{detailItem.description}</span>
              )}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--background)' }}>
                    <th style={thStyle}>Account</th>
                    <th style={{ ...thStyle, width: 150, textAlign: 'right' }}>Debit</th>
                    <th style={{ ...thStyle, width: 150, textAlign: 'right' }}>Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLoading ? (
                    <tr>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                        Loading…
                      </td>
                    </tr>
                  ) : sortedDetailLines.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                        No journal lines
                      </td>
                    </tr>
                  ) : (
                    sortedDetailLines.map((line, idx) => (
                      <tr key={line.id ?? idx}>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 13, color: 'var(--foreground)' }}>
                            {line.chart_of_account
                              ? `${line.chart_of_account.code} — ${line.chart_of_account.name}`
                              : `Account #${line.chart_of_account_id}`}
                          </div>
                          {line.description && (
                            <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>{line.description}</div>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {Number(line.debit) > 0 ? `Rp ${Number(line.debit).toLocaleString('id-ID')}` : ''}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {Number(line.credit) > 0 ? `Rp ${Number(line.credit).toLocaleString('id-ID')}` : ''}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--background)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Total</td>
                    <td style={{
                      padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: detailIsBalanced ? 'var(--foreground)' : 'var(--warning)',
                    }}>
                      Rp {detailTotalDebit.toLocaleString('id-ID')}
                    </td>
                    <td style={{
                      padding: '10px 16px', textAlign: 'right', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: detailIsBalanced ? 'var(--foreground)' : 'var(--warning)',
                    }}>
                      Rp {detailTotalCredit.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
