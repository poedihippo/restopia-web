'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowUpRight, Inbox, Loader2, Plus, Trash2, Undo2 } from 'lucide-react'
import { paymentsService } from '@/services/payments.service'
import { paymentMethodsService } from '@/services/payment-methods.service'
import { bankAccountsService } from '@/services/bank-accounts.service'
import { branchesService } from '@/services/branches.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import { toastMutationApiError } from '@/utils/apiError'
import { formatCurrency } from '@/utils/price'
import { formatDateShort } from '@/utils/date'
import { CustomPagination } from '@/components/ui/CustomPagination'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import SearchableSelect from '@/components/SearchableSelect'
import { useAuth } from '@/hooks/useAuth'

/*
 * Settle Payments: customer payments whose method requires settlement (Cash,
 * Visa, BCA, QRIS, …) stay in Piutang Dagang until the money reaches the bank.
 * A settlement clears one outlet + one method for a PERIOD (accumulated, not
 * per invoice): D Bank (received) + D each "biaya lainnya" row / K Piutang,
 * where received + fees = the period's total. Undo reverses it.
 * The backend only settles payments of the active branch.
 */

const today = () => new Date().toLocaleDateString('en-CA')
const firstOfMonth = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA')
}

const controlStyle: React.CSSProperties = {
  height: 36,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '0 10px',
  fontSize: 13,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  minWidth: 0,
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  display: 'block',
  marginBottom: 6,
}

const fieldErrorStyle: React.CSSProperties = { fontSize: 12, color: 'var(--destructive)', marginTop: 4 }

const bankLabel = (b: any) =>
  b ? `${b.bank_name ?? 'Bank'} ${b.account_number ?? ''}${b.account_name ? ` · ${b.account_name}` : ''}`.trim() : '—'

function orderLinks(allocations: any[] = []) {
  return allocations
    .filter((a) => a.sales_order_id || a.invoice_id)
    .map((a) =>
      a.sales_order_id
        ? { key: `so-${a.id}`, label: `SO #${a.sales_order_id}`, href: `/sales/sales-orders/${a.sales_order_id}/detail` }
        : { key: `inv-${a.id}`, label: `INV #${a.invoice_id}`, href: `/transfer/invoices/${a.invoice_id}` },
    )
}

type Tab = 'pending' | 'settled'
type FeeRow = { key: number; chart_of_account_id: number; amount?: number; description: string }

let feeKey = 0
const newFee = (coaId = 0): FeeRow => ({ key: ++feeKey, chart_of_account_id: coaId, amount: undefined, description: '' })

export default function PaymentSettlementsView() {
  const { hasPermission, user } = useAuth()
  const activeBranchId = Number((user as any)?.branch?.id) || 0
  const activeBranchName: string = (user as any)?.branch?.name ?? ''
  const canSettle = hasPermission('payment.create')
  const canUndo = hasPermission('payment.delete')
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>('pending')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  // Pending tab: the period being settled is always the active branch.
  const [methodId, setMethodId] = useState<number | ''>('')
  const [dateGte, setDateGte] = useState(firstOfMonth())
  const [dateLte, setDateLte] = useState(today())
  // History tab filters.
  const [historyBranchId, setHistoryBranchId] = useState<number | ''>(activeBranchId || '')

  const [bankAccountId, setBankAccountId] = useState(0)
  const [fees, setFees] = useState<FeeRow[]>([])
  const [settleDate, setSettleDate] = useState(today())
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [undoTarget, setUndoTarget] = useState<any>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [tab, searchDebounced, methodId, dateGte, dateLte, historyBranchId])

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'payment-settlements'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name' } as any).then((r) => r.data),
  })
  const branches: any[] = (branchesData as any)?.data ?? []

  const { data: methodsData } = useQuery({
    queryKey: ['payment-methods-all', 'requires-settlement'],
    queryFn: () =>
      paymentMethodsService
        .list({ per_page: 200, sort: 'name', 'filter[requires_settlement]': true } as any)
        .then((r) => r.data),
  })
  const methods: any[] = ((methodsData as any)?.data ?? []).filter((m: any) => m.requires_settlement !== false)
  const method = methods.find((m) => Number(m.id) === Number(methodId))

  // Pre-fill the first "biaya lainnya" row with the method's default fee account.
  useEffect(() => {
    setFees(method?.settlement_fee_chart_of_account_id ? [newFee(Number(method.settlement_fee_chart_of_account_id))] : [])
    setFieldErrors({})
  }, [method?.id, method?.settlement_fee_chart_of_account_id])

  const { data: banksData, isLoading: banksLoading } = useQuery({
    queryKey: ['bank-accounts-all', 'active'],
    queryFn: () =>
      bankAccountsService.list({ per_page: 200, sort: 'bank_name', 'filter[is_active]': true } as any).then((r) => r.data),
  })
  const bankAccounts: any[] = ((banksData as any)?.data ?? []).filter((b: any) => b.is_active !== false)

  const { data: feeCoaData, isLoading: feeCoaLoading } = useQuery({
    queryKey: ['chart-of-accounts-fee'],
    enabled: tab === 'pending' && canSettle,
    queryFn: () =>
      chartOfAccountsService
        .list({
          per_page: 1000,
          sort: 'code',
          'filter[is_header]': 'false',
          'filter[is_active]': 'true',
          'filter[normal_balance]': 'debit',
        } as any)
        .then((r) => (r.data as any)?.data ?? []),
  })
  const feeCoaOptions = ((feeCoaData ?? []) as any[]).map((c: any) => ({
    value: Number(c.id),
    label: c.name ?? `COA #${c.id}`,
    sublabel: c.code ?? undefined,
  }))

  const periodReady = !!activeBranchId && !!methodId && !!dateGte && !!dateLte && dateGte <= dateLte

  // Accumulated Piutang for the period (what one settlement clears).
  const { data: previewData, isFetching: previewLoading } = useQuery({
    queryKey: ['payment-settlements', 'preview', activeBranchId, methodId, dateGte, dateLte],
    enabled: tab === 'pending' && periodReady,
    queryFn: () =>
      paymentsService
        .previewSettlement({
          branch_id: activeBranchId,
          payment_method_id: Number(methodId),
          date_gte: dateGte,
          date_lte: dateLte,
        })
        .then((r) => (r.data as any)?.data ?? null),
  })
  const preview = previewData as { count?: number; total_amount?: number } | null | undefined
  const total = Number(preview?.total_amount ?? 0)
  const feeTotal = fees.reduce((s, f) => s + Number(f.amount ?? 0), 0)
  const received = total - feeTotal

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['payment-settlements', tab, page, perPage, searchDebounced, activeBranchId, methodId, dateGte, dateLte, historyBranchId],
    queryFn: () =>
      tab === 'pending'
        ? paymentsService
            .list({
              sort: '-date',
              include: 'branch,payment_method,allocations',
              'filter[search]': searchDebounced || undefined,
              'filter[branch_id]': activeBranchId || undefined,
              'filter[payment_method_id]': methodId || undefined,
              'filter[date_gte]': dateGte || undefined,
              'filter[date_lte]': dateLte || undefined,
              'filter[type]': 'receive',
              'filter[settlement_status]': 'pending',
              'filter[is_reversed]': false,
              page,
              per_page: perPage,
            })
            .then((r) => r.data)
        : paymentsService
            .listSettlements({
              sort: '-date',
              include: 'branch,payment_method,bank_account',
              'filter[search]': searchDebounced || undefined,
              'filter[branch_id]': historyBranchId || undefined,
              'filter[payment_method_id]': methodId || undefined,
              page,
              per_page: perPage,
            })
            .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching
  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const resetForm = () => {
    setBankAccountId(0)
    setFees(method?.settlement_fee_chart_of_account_id ? [newFee(Number(method.settlement_fee_chart_of_account_id))] : [])
    setSettleDate(today())
    setDescription('')
    setFieldErrors({})
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payment-settlements'] })
    qc.invalidateQueries({ queryKey: ['payments'] })
    qc.invalidateQueries({ queryKey: ['sale-payment-journals'] })
    qc.invalidateQueries({ queryKey: ['sales-orders'] })
  }

  const usedFees = fees.filter((f) => Number(f.amount ?? 0) > 0)

  const { mutate: submit, isPending: submitting } = useMutation({
    mutationFn: () =>
      paymentsService.createSettlement({
        branch_id: activeBranchId,
        payment_method_id: Number(methodId),
        date_gte: dateGte,
        date_lte: dateLte,
        bank_account_id: bankAccountId,
        received_amount: received,
        fees: usedFees.map((f) => ({
          chart_of_account_id: f.chart_of_account_id,
          amount: Number(f.amount),
          description: f.description.trim() || undefined,
        })),
        date: settleDate,
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate()
      toast.success(`Settlement ${method?.name ?? ''} dicatat (${formatCurrency(total)})`)
      resetForm()
    },
    onError: (err: any) => {
      const errors = err?.response?.data?.errors
      if (errors && typeof errors === 'object') {
        const mapped: Record<string, string> = {}
        Object.entries(errors).forEach(([k, v]) => {
          mapped[k.replace(/\[(\d+)\]/g, '.$1')] = String(Array.isArray(v) ? v[0] : v)
        })
        setFieldErrors(mapped)
      }
      toastMutationApiError(err, 'Gagal mencatat settlement')
    },
  })

  const handleSubmit = () => {
    if (!activeBranchId) return toast.error('Pilih cabang aktif terlebih dahulu')
    if (!methodId) return toast.error('Pilih metode pembayaran')
    if (!periodReady) return toast.error('Isi periode dengan benar')
    if (!(total > 0)) return toast.error('Tidak ada piutang yang menunggu settlement di periode ini')
    if (!bankAccountId) return toast.error('Pilih akun kas/bank tujuan')
    if (fees.some((f) => Number(f.amount ?? 0) > 0 && !f.chart_of_account_id))
      return toast.error('Pilih akun untuk setiap biaya')
    if (!(received > 0)) return toast.error('Biaya tidak boleh sama dengan atau melebihi total piutang')
    if (!settleDate) return toast.error('Isi tanggal settlement')
    // The backend refuses a settlement dated before the end of its period.
    if (settleDate < dateLte) return toast.error('Tanggal settlement tidak boleh sebelum akhir periode')
    submit()
  }

  const { mutate: undo, isPending: undoing } = useMutation({
    mutationFn: (id: number) => paymentsService.undoSettlement(id),
    onSuccess: () => {
      invalidate()
      toast.success('Settlement dibatalkan — pembayaran kembali menunggu settlement')
      setUndoTarget(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal membatalkan settlement'),
  })

  const updateFee = (key: number, patch: Partial<FeeRow>) =>
    setFees((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      style={{
        padding: '10px 16px',
        background: 'none',
        border: 'none',
        borderBottom: `2px solid ${tab === value ? 'var(--accent)' : 'transparent'}`,
        color: tab === value ? 'var(--foreground)' : 'var(--foreground-muted)',
        fontSize: 14,
        fontWeight: tab === value ? 600 : 500,
        cursor: 'pointer',
        marginBottom: -1,
      }}
    >
      {label}
    </button>
  )

  const colCount = tab === 'pending' ? 6 : 8

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
          Settle Payments
        </h1>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
          Pembayaran Cash, Visa, BCA, dll. tetap di Piutang Dagang sampai dana masuk. Settlement melunasi piutang satu metode untuk satu periode
          (akumulasi, bukan per invoice).
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {tabButton('pending', 'Menunggu Settlement')}
        {tabButton('settled', 'Riwayat Settlement')}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          type="search"
          data-search
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === 'pending' ? 'Cari no. pembayaran...' : 'Cari kode settlement...'}
          style={{ ...controlStyle, width: 220 }}
        />
        {tab === 'pending' ? (
          <span
            title="Settlement hanya untuk cabang aktif"
            style={{ ...controlStyle, display: 'inline-flex', alignItems: 'center', background: 'var(--background)', color: 'var(--foreground-muted)' }}
          >
            Outlet: {activeBranchName || '—'}
          </span>
        ) : (
          <select value={historyBranchId} onChange={(e) => setHistoryBranchId(e.target.value ? Number(e.target.value) : '')} style={{ ...controlStyle, width: 200 }}>
            <option value="">Semua outlet</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <select value={methodId} onChange={(e) => setMethodId(e.target.value ? Number(e.target.value) : '')} style={{ ...controlStyle, width: 180 }}>
          <option value="">{tab === 'pending' ? 'Pilih metode…' : 'Semua metode'}</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        {tab === 'pending' && (
          <>
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Periode</span>
            <input type="date" value={dateGte} onChange={(e) => setDateGte(e.target.value)} style={controlStyle} />
            <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>s/d</span>
            <input type="date" value={dateLte} onChange={(e) => setDateLte(e.target.value)} style={controlStyle} />
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                {tab === 'pending' ? (
                  <tr>
                    <th style={thStyle}>No. Pembayaran</th>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>Metode</th>
                    <th style={thStyle}>Outlet</th>
                    <th style={thStyle}>Untuk</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Jumlah</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={thStyle}>Kode</th>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>Periode</th>
                    <th style={thStyle}>Metode · Outlet</th>
                    <th style={thStyle}>Akun Bank</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Diterima</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Biaya</th>
                    <th style={{ ...thStyle, textAlign: 'right' }} />
                  </tr>
                )}
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: colCount }).map((__, j) => (
                        <td key={j} style={tdStyle}>
                          <div style={{ height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--background)' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', color: 'var(--destructive)' }}>
                      Gagal memuat data.
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                      <Inbox size={28} color="var(--foreground-subtle)" />
                      <div style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 8 }}>
                        {tab === 'pending' ? 'Tidak ada pembayaran yang menunggu settlement di periode ini.' : 'Belum ada settlement.'}
                      </div>
                    </td>
                  </tr>
                ) : tab === 'pending' ? (
                  items.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{p.payment_number ?? `#${p.id}`}</td>
                      <td style={tdStyle}>{formatDateShort(p.date)}</td>
                      <td style={tdStyle}>{p.payment_method?.name ?? '—'}</td>
                      <td style={tdStyle}>{p.branch?.name ?? '—'}</td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {orderLinks(p.allocations).map((l) => (
                            <a key={l.key} href={l.href} target="_blank" rel="noopener" className="v2-link" style={{ fontSize: 13 }}>
                              {l.label}
                              <ArrowUpRight size={11} />
                            </a>
                          ))}
                        </div>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(p.amount)}</td>
                    </tr>
                  ))
                ) : (
                  items.map((s) => (
                    <tr key={s.id} style={{ opacity: s.is_reversed ? 0.55 : 1 }}>
                      <td style={{ ...tdStyle, fontWeight: 500, textDecoration: s.is_reversed ? 'line-through' : 'none' }}>{s.code ?? `#${s.id}`}</td>
                      <td style={tdStyle}>{formatDateShort(s.date)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {s.period_start ? `${formatDateShort(s.period_start)} – ${formatDateShort(s.period_end)}` : '—'}
                      </td>
                      <td style={tdStyle}>
                        {s.payment_method?.name ?? '—'}
                        <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{s.branch?.name ?? ''}</div>
                      </td>
                      <td style={tdStyle}>{bankLabel(s.bank_account)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>{formatCurrency(s.received_amount)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ color: Number(s.fee_amount) > 0 ? 'var(--warning)' : undefined }}>{formatCurrency(s.fee_amount ?? 0)}</span>
                        {(s.fees ?? []).map((f: any, i: number) => (
                          <div key={f.id ?? i} style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
                            {f.chart_of_account?.name ?? `COA #${f.chart_of_account_id}`}: {formatCurrency(f.amount)}
                          </div>
                        ))}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {s.is_reversed ? (
                          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Dibatalkan</span>
                        ) : (
                          canUndo && (
                            <button
                              type="button"
                              onClick={() => setUndoTarget(s)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                height: 30,
                                padding: '0 10px',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--surface)',
                                color: 'var(--foreground)',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              <Undo2 size={13} /> Undo
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
        </div>

        {tab === 'pending' && canSettle && (
          <div
            style={{
              flex: '0 1 360px',
              minWidth: 290,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              position: 'sticky',
              top: 16,
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0, color: 'var(--foreground)' }}>Settlement</h2>

            <div style={{ background: 'var(--background)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: 13 }}>
              {!methodId ? (
                <span style={{ color: 'var(--foreground-muted)' }}>Pilih metode dan periode untuk melihat total piutangnya.</span>
              ) : previewLoading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--foreground-muted)' }}>
                  <Loader2 size={13} className="animate-spin" /> Menghitung piutang…
                </span>
              ) : (
                <>
                  <div style={{ color: 'var(--foreground-muted)' }}>
                    Piutang {method?.name ?? ''} · {activeBranchName} · {formatDateShort(dateGte)} – {formatDateShort(dateLte)}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--foreground)', marginTop: 4 }}>{formatCurrency(total)}</div>
                  <div style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{preview?.count ?? 0} pembayaran</div>
                </>
              )}
            </div>

            <div>
              <label style={labelStyle}>Akun Kas/Bank tujuan *</label>
              <SearchableSelect
                value={bankAccountId}
                onChange={(val: any) => setBankAccountId(Number(val) || 0)}
                options={bankAccounts.map((b) => ({ value: Number(b.id), label: bankLabel(b) }))}
                placeholder="Pilih akun bank"
                searchPlaceholder="Cari bank / no. rekening..."
                loading={banksLoading}
                error={fieldErrors.bank_account_id || undefined}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>Biaya lainnya (admin / MDR)</span>
                <button
                  type="button"
                  onClick={() => setFees((rows) => [...rows, newFee()])}
                  className="v2-btn-outline v2-btn-sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    height: 28,
                    padding: '0 10px',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface)',
                    color: 'var(--accent)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={12} /> Tambah biaya
                </button>
              </div>
              {fees.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>Tidak ada biaya — seluruh piutang diterima bank.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {fees.map((f, i) => (
                    <div key={f.key} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <SearchableSelect
                            value={f.chart_of_account_id}
                            onChange={(val: any) => updateFee(f.key, { chart_of_account_id: Number(val) || 0 })}
                            options={feeCoaOptions}
                            placeholder="Pilih akun biaya"
                            searchPlaceholder="Cari nama / kode akun..."
                            loading={feeCoaLoading}
                            error={fieldErrors[`fees.${i}.chart_of_account_id`] || undefined}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setFees((rows) => rows.filter((r) => r.key !== f.key))}
                          title="Hapus biaya"
                          style={{ background: 'none', border: 'none', color: 'var(--foreground-muted)', cursor: 'pointer', display: 'flex', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <LocalizedNumberInput
                        value={f.amount}
                        onChange={(val) => updateFee(f.key, { amount: val })}
                        decimals={2}
                        padDecimals={false}
                        placeholder="Jumlah biaya"
                        error={!!fieldErrors[`fees.${i}.amount`]}
                      />
                      <input
                        value={f.description}
                        onChange={(e) => updateFee(f.key, { description: e.target.value })}
                        placeholder="Keterangan (opsional)"
                        style={{ ...controlStyle, width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {fieldErrors.fees && <div style={fieldErrorStyle}>{fieldErrors.fees}</div>}
            </div>

            <div>
              <label style={labelStyle}>Tanggal settlement *</label>
              <input
                type="date"
                value={settleDate}
                min={dateLte || undefined}
                onChange={(e) => setSettleDate(e.target.value)}
                style={{ ...controlStyle, width: '100%', boxSizing: 'border-box' }}
              />
              {fieldErrors.date && <div style={fieldErrorStyle}>{fieldErrors.date}</div>}
            </div>

            <div>
              <label style={labelStyle}>Keterangan</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`Settlement ${method?.name ?? ''}`.trim()}
                style={{ ...controlStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ background: 'var(--background)', borderRadius: 'var(--radius-md)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Total piutang</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Biaya lainnya</span>
                <span style={{ fontWeight: 600, color: feeTotal > 0 ? 'var(--warning)' : undefined }}>{formatCurrency(feeTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Diterima bank</span>
                <span style={{ fontWeight: 700, color: received <= 0 && total > 0 ? 'var(--destructive)' : 'var(--foreground)' }}>{formatCurrency(received)}</span>
              </div>
              {fieldErrors.received_amount && <div style={fieldErrorStyle}>{fieldErrors.received_amount}</div>}
              <div style={{ fontSize: 12, color: 'var(--foreground-subtle)', marginTop: 2 }}>
                Jurnal: D Bank {usedFees.length > 0 ? `+ D ${usedFees.length} akun biaya ` : ''}/ K Piutang Dagang
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !(total > 0)}
              style={{
                height: 40,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: submitting || !(total > 0) ? 'var(--foreground-subtle)' : 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting || !(total > 0) ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Menyimpan...' : 'Settle'}
            </button>
          </div>
        )}
      </div>

      {undoTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => !undoing && setUndoTarget(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div
            style={{
              position: 'relative',
              width: 420,
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 24,
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: '0 0 8px', color: 'var(--foreground)' }}>Undo settlement?</h3>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Settlement <b>{undoTarget.code ?? `#${undoTarget.id}`}</b> akan dibalik dengan jurnal pembalik, dan pembayarannya kembali menunggu settlement.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setUndoTarget(null)}
                disabled={undoing}
                style={{ height: 36, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', fontSize: 13, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => undo(Number(undoTarget.id))}
                disabled={undoing}
                style={{
                  height: 36,
                  padding: '0 16px',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--destructive)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: undoing ? 'not-allowed' : 'pointer',
                  opacity: undoing ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {undoing && <Loader2 size={13} className="animate-spin" />}
                {undoing ? 'Memproses...' : 'Undo settlement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
