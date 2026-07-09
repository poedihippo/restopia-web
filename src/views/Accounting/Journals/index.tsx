'use client'
import { formatDate } from '@/utils/date';

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  journalsService, periodsService, chartOfAccountsService,
  type JournalRequest,
} from '@/services/accounting.service'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import {
  Plus, Search, Pencil, Trash2, ChevronLeft, ChevronRight,
  X, Loader2, FileText, CheckCircle2, Send, AlertCircle,
} from 'lucide-react'

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
  journal_date: string
  journal_type: string
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
  chart_of_account_id: z.coerce.number().min(1, 'Akun wajib dipilih'),
  debit: z.coerce.number().min(0),
  credit: z.coerce.number().min(0),
  description: z.string().optional(),
})

const schema = z.object({
  period_id: z.coerce.number().min(1, 'Periode wajib dipilih'),
  journal_date: z.string().min(1, 'Tanggal wajib diisi'),
  journal_type: z.enum(['general', 'adjusting', 'closing', 'reversing']),
  description: z.string().optional(),
  details: z.array(detailSchema).min(2, 'Minimal 2 baris jurnal'),
})
type FormValues = z.infer<typeof schema>

const JOURNAL_TYPE_LABELS: Record<string, string> = {
  general: 'Umum',
  adjusting: 'Penyesuaian',
  closing: 'Penutup',
  reversing: 'Balik',
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
  const queryClient = useQueryClient()
  const { isSuperadmin } = useAuth()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Journal | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)
  const [detailItem, setDetailItem] = useState<Journal | null>(null)

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 400); return () => clearTimeout(t) }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch])

  const { data, isLoading } = useQuery({
    queryKey: ['journals', page, debouncedSearch],
    queryFn: () => journalsService.list({ page, per_page: 15, sort: '-id', include: 'period', 'filter[search]': debouncedSearch || undefined }).then((r) => r.data),
  })

  const { data: periodsData } = useQuery({
    queryKey: ['periods-all'],
    queryFn: () => periodsService.list({ per_page: 999, sort: '-id' }).then((r) => r.data),
  })

  const { data: coaData } = useQuery({
    queryKey: ['chart-of-accounts-all'],
    queryFn: () => chartOfAccountsService.list({ per_page: 999, sort: 'code', 'filter[is_active]': 'true' } as any).then((r) => r.data),
  })

  const items: Journal[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const periods: Period[] = (periodsData as any)?.data ?? []
  const accounts: CoA[] = (coaData as any)?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => journalsService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Jurnal dihapus'); setDeleteConfirmId(null) },
    onError: (err: any) => toastMutationApiError(err, 'Gagal menghapus'),
  })

  const postMutation = useMutation({
    mutationFn: (id: number) => journalsService.post(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Jurnal diposting') },
    onError: (err: any) => toastMutationApiError(err, 'Gagal posting jurnal'),
  })

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      period_id: 0, journal_date: '', journal_type: 'general', description: '',
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
        journal_date: editData.journal_date?.substring(0, 10) ?? '',
        journal_type: editData.journal_type as any,
        description: editData.description ?? '',
        details: editData.journal_details?.length
          ? editData.journal_details.map((d) => ({ chart_of_account_id: d.chart_of_account_id, debit: d.debit, credit: d.credit, description: d.description ?? '' }))
          : [{ chart_of_account_id: 0, debit: 0, credit: 0, description: '' }, { chart_of_account_id: 0, debit: 0, credit: 0, description: '' }],
      })
    } else {
      reset({ period_id: 0, journal_date: '', journal_type: 'general', description: '', details: [{ chart_of_account_id: 0, debit: 0, credit: 0, description: '' }, { chart_of_account_id: 0, debit: 0, credit: 0, description: '' }] })
    }
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: JournalRequest) => journalsService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Jurnal dibuat'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Gagal membuat'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: JournalRequest) => journalsService.update(editData!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['journals'] }); toast.success('Jurnal diperbarui'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Gagal memperbarui'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: FormValues) => {
    const payload: JournalRequest = {
      period_id: values.period_id,
      journal_date: values.journal_date,
      journal_type: values.journal_type,
      description: values.description,
      details: values.details.map((d) => ({ chart_of_account_id: d.chart_of_account_id, debit: Number(d.debit), credit: Number(d.credit), description: d.description })),
    }
    if (editData) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const numInputStyle: React.CSSProperties = { ...inputStyle, textAlign: 'right' }
  const smallInputStyle: React.CSSProperties = { ...inputStyle, padding: '7px 10px', fontSize: 13 }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Jurnal</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Entri jurnal akuntansi dengan metode double-entry (debit = kredit)</p>
        </div>
        {isSuperadmin && (
          <button onClick={() => { setEditData(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={16} /> Jurnal Baru
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ position: 'relative', width: 300 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor atau deskripsi jurnal..."
            style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)', background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 140 }}>No. Jurnal</th>
              <th style={{ ...thStyle, width: 130 }}>Tanggal</th>
              <th style={{ ...thStyle, width: 130 }}>Tipe</th>
              <th style={thStyle}>Deskripsi</th>
              <th style={{ ...thStyle, width: 110 }}>Periode</th>
              <th style={{ ...thStyle, width: 90 }}>Status</th>
              <th style={{ ...thStyle, width: 100 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} style={tdStyle}><div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 6 ? 60 : '80%', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                ))}</tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <FileText size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>Belum ada jurnal</span>
                </div>
              </td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} style={{ transition: 'background 120ms' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--background)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}><span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--foreground-muted)' }}>{item.journal_number}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.journal_date ? fmtDate(item.journal_date) : '—'}</span></td>
                  <td style={tdStyle}>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 12, background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                      {JOURNAL_TYPE_LABELS[item.journal_type] ?? item.journal_type}
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
                      {!item.is_posted && isSuperadmin && (
                        <>
                          <button onClick={() => postMutation.mutate(item.id)} disabled={postMutation.isPending} title="Posting Jurnal"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: '#10b981', display: 'flex' }}><Send size={13} /></button>
                          <button onClick={() => { setEditData(item); setSheetOpen(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><Pencil size={14} /></button>
                          <button onClick={() => setDeleteConfirmId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--destructive)', display: 'flex' }}><Trash2 size={14} /></button>
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

      {meta && meta.last_page > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Halaman {page} dari {meta.last_page}</span>
          <button onClick={() => setPage((p) => Math.min(meta.last_page, p + 1))} disabled={page === meta.last_page} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: page === meta.last_page ? 'var(--foreground-subtle)' : 'var(--foreground)', cursor: page === meta.last_page ? 'not-allowed' : 'pointer', fontSize: 13 }}><ChevronRight size={15} /></button>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 360, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Hapus Jurnal</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>Hanya jurnal draft yang dapat dihapus.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Batal</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSheetOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 50, width: 680, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>{editData ? 'Edit Jurnal' : 'Jurnal Baru'}</h2>
              <button onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Periode <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <select {...register('period_id')} style={inputStyle}>
                    <option value={0}>-- Pilih Periode --</option>
                    {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Tanggal <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <input type="date" {...register('journal_date')} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Tipe Jurnal</label>
                  <select {...register('journal_type')} style={inputStyle}>
                    <option value="general">Umum</option>
                    <option value="adjusting">Penyesuaian</option>
                    <option value="closing">Penutup</option>
                    <option value="reversing">Balik</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Deskripsi</label>
                  <input {...register('description')} placeholder="Keterangan jurnal" style={inputStyle} />
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Baris Jurnal</label>
                  <button type="button" onClick={() => append({ chart_of_account_id: 0, debit: 0, credit: 0, description: '' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 12, cursor: 'pointer' }}>
                    <Plus size={12} /> Tambah Baris
                  </button>
                </div>

                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--background)' }}>
                        <th style={{ ...thStyle, fontSize: 11 }}>Akun</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 110, textAlign: 'right' }}>Debit (Rp)</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 110, textAlign: 'right' }}>Kredit (Rp)</th>
                        <th style={{ ...thStyle, fontSize: 11, width: 130 }}>Keterangan</th>
                        <th style={{ ...thStyle, width: 36 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, idx) => (
                        <tr key={field.id}>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                            <select {...register(`details.${idx}.chart_of_account_id`)} style={{ ...smallInputStyle, fontSize: 12 }}>
                              <option value={0}>-- Pilih Akun --</option>
                              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                            <input type="number" min={0} {...register(`details.${idx}.debit`)} style={{ ...smallInputStyle, textAlign: 'right', fontSize: 12 }} placeholder="0" />
                          </td>
                          <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
                            <input type="number" min={0} {...register(`details.${idx}.credit`)} style={{ ...smallInputStyle, textAlign: 'right', fontSize: 12 }} placeholder="0" />
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
                      ))}
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
              <button type="button" onClick={() => setSheetOpen(false)} style={{ padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Batal</button>
              <button type="button" disabled={isPending} onClick={handleSubmit(onSubmit)} style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: isPending ? 0.7 : 1 }}>
                {isPending && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {editData ? 'Simpan' : 'Buat Jurnal (Draft)'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
