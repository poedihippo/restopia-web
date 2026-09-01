'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  budgetsService, periodsService, chartOfAccountsService,
  type BudgetRequest,
} from '@/services/accounting.service'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toastMutationApiError } from '@/utils/apiError'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'
import {
  Plus, Pencil, Trash2,
  X, Loader2, PiggyBank, Download,
} from 'lucide-react'

interface Budget {
  id: number
  amount: number
  chart_of_account_id: number
  period_id: number
  chart_of_account?: { id: number; code: string; name: string }
  period?: { id: number; name: string }
  created_at?: string
}

interface Period { id: number; name: string }
interface CoA { id: number; code: string; name: string }

const schema = z.object({
  chart_of_account_id: z.coerce.number().min(1, 'Account is required'),
  period_id: z.coerce.number().min(1, 'Period is required'),
  amount: z.coerce.number().min(1, 'Amount wajib diisi'),
})
type FormValues = z.infer<typeof schema>

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', fontSize: 14, color: 'var(--foreground)',
  background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}
const inputError: React.CSSProperties = { ...inputStyle, border: '1px solid var(--destructive)' }
const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
  color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
const fmtCurrency = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n)

export default function BudgetsView() {
  const queryClient = useQueryClient()
  const { isSuperadmin, hasPermission } = useAuth()
  const canCreate = isSuperadmin || hasPermission('budget.create')
  const canUpdate = isSuperadmin || hasPermission('budget.update')
  const canDelete = isSuperadmin || hasPermission('budget.delete')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editData, setEditData] = useState<Budget | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['budgets', page, perPage],
    queryFn: () => budgetsService.list({ page, per_page: perPage, sort: '-id', include: 'chart_of_account,period' }).then((r) => r.data),
  })

  const { data: periodsData } = useQuery({
    queryKey: ['periods-all'],
    queryFn: () => periodsService.list({ per_page: perPage, sort: '-id' }).then((r) => r.data),
  })

  const { data: coaData } = useQuery({
    queryKey: ['chart-of-accounts-all'],
    queryFn: () => chartOfAccountsService.list({ per_page: perPage, sort: 'code' }).then((r) => r.data),
  })

  const items: Budget[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta
  const periods: Period[] = (periodsData as any)?.data ?? []
  const accounts: CoA[] = (coaData as any)?.data ?? []

  const deleteMutation = useMutation({
    mutationFn: (id: number) => budgetsService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); toast.success('Budget deleted'); setDeleteConfirmId(null) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete'),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { chart_of_account_id: 0, period_id: 0, amount: 0 },
  })

  useEffect(() => {
    if (editData) reset({ chart_of_account_id: editData.chart_of_account_id, period_id: editData.period_id, amount: editData.amount })
    else reset({ chart_of_account_id: 0, period_id: 0, amount: 0 })
  }, [editData, reset])

  const createMutation = useMutation({
    mutationFn: (data: BudgetRequest) => budgetsService.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); toast.success('Budget created'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to create'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: BudgetRequest) => budgetsService.update(editData!.id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['budgets'] }); toast.success('Budgets diperbarui'); setSheetOpen(false) },
    onError: (err: any) => toastMutationApiError(err, 'Failed to update'),
  })

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportBudgets(),
    onSuccess: (res) => { downloadFileFromResponse(res, 'budgets.xlsx') },
    onError: () => toast.error('Gagal mengekspor data.'),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const onSubmit = (values: FormValues) => {
    if (editData) updateMutation.mutate(values as BudgetRequest)
    else createMutation.mutate(values as BudgetRequest)
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Budgets</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Budget allocation per account per period for financial planning</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => exportExcel()} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.6 : 1 }}>
            <Download size={14} /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          {canCreate && (
            <button onClick={() => { setEditData(null); setSheetOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={16} /> New Budget
            </button>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Account</th>
              <th style={{ ...thStyle, width: 180 }}>Periode</th>
              <th style={{ ...thStyle, width: 160, textAlign: 'right' }}>Amount Budgets</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((__, j) => (
                  <td key={j} style={tdStyle}><div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--border)', width: j === 4 ? 40 : '80%', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                ))}</tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: 'var(--foreground-muted)' }}>
                  <PiggyBank size={32} style={{ opacity: 0.4 }} />
                  <span style={{ fontSize: 14 }}>No budgets found</span>
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
                  <td style={tdStyle}>
                    {item.chart_of_account
                      ? <div><span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--foreground-muted)', marginRight: 6 }}>{item.chart_of_account.code}</span><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{item.chart_of_account.name}</span></div>
                      : <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>—</span>}
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{item.period?.name || '—'}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{fmtCurrency(item.amount)}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {canUpdate && <button onClick={() => { setEditData(item); setSheetOpen(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--foreground-muted)', display: 'flex' }}><Pencil size={14} /></button>}
                      {canDelete && <button onClick={() => setDeleteConfirmId(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--destructive)', display: 'flex' }}><Trash2 size={14} /></button>}
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
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Budget</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>This action cannot be undone.</p>
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
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>{editData ? 'Edit Budget' : 'New Budget'}</h2>
              <button onClick={() => setSheetOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Account <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <select {...register('chart_of_account_id')} style={errors.chart_of_account_id ? inputError : inputStyle}>
                  <option value={0}>-- Select Account --</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} – {a.name}</option>)}
                </select>
                {errors.chart_of_account_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.chart_of_account_id.message}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Periode <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <select {...register('period_id')} style={errors.period_id ? inputError : inputStyle}>
                  <option value={0}>-- Select Period --</option>
                  {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.period_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.period_id.message}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Amount (Rp) <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <input type="number" min={0} {...register('amount')} placeholder="e.g. 5000000" style={errors.amount ? { ...inputError, textAlign: 'right' } : { ...inputStyle, textAlign: 'right' }} />
                {errors.amount && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.amount.message}</span>}
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
