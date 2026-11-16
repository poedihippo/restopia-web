'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import BackLink from '@/components/BackLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import ReferenceLink from '@/components/ReferenceLink'
import { useCentralCompanyScope } from '@/hooks/useCentralCompanyScope'
import { suppliersService } from '@/services/suppliers.service'
import { purchaseOrdersService } from '@/services/purchase-orders.service'
import { fetchAllPages } from '@/utils/salesReport'
import { paymentsService } from '@/services/payments.service'
import { bankAccountsService } from '@/services/bank-accounts.service'
import { toastMutationApiError } from '@/utils/apiError'
import SearchableSelect from '@/components/SearchableSelect'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { formatDate, parseApiDate } from '@/utils/date'
import { formatCurrency } from '@/utils/price'
import { supplierDebtsBasePath, type SupplierDebtsMode } from './index'
import { AlertCircle, ArrowUpRight, Download, Info, Lock, Receipt, Wallet, X } from 'lucide-react'
import { downloadExcel, money, reportHeader } from '@/utils/excelExport'

interface Supplier {
  id: number
  code: string
  name: string
  phone?: string
  address?: string
}

interface PurchaseOrder {
  id: number
  code: string
  date?: string
  total_price: number
  status?: string
  total_payment?: number
  remaining_payment?: number
  supplier?: Supplier
  branch_id?: number
  branch?: { id: number; name: string }
}

// Pending (draft) and rejected POs are never a payable debt.
const NON_PAYABLE_PO_STATUSES = ['pending', 'rejected']

interface DisbursePayment {
  id: number
  payment_number?: string
  date?: string
  created_at?: string
  amount: number
  is_reversed?: boolean
  payment_method?: { id: number; name: string }
  bank_account?: { id: number; bank_name?: string; account_number?: string; account_name?: string }
  allocations?: { purchase_order_id?: number; amount: number }[]
}

// v2 detail-page building blocks (same look as Receipts / PO detail).
const containerStyle: React.CSSProperties = {
  padding: '28px 24px 48px',
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  padding: '14px 20px',
  borderBottom: '1px solid var(--border)',
}

const cardTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--foreground)',
  margin: 0,
}

const thStyle: React.CSSProperties = {
  height: 'auto',
  padding: '10px 14px',
  fontSize: 11.5,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--foreground-muted)',
  background: 'var(--surface-muted)',
  whiteSpace: 'nowrap',
  textAlign: 'left',
}

const tdStyle: React.CSSProperties = {
  height: 'auto',
  padding: '12px 14px',
  fontSize: 13.5,
  color: 'var(--foreground)',
  verticalAlign: 'middle',
}

const amountTdStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

// First / last columns keep the 20px card gutter.
const edgeL: React.CSSProperties = { paddingLeft: 20 }
const edgeR: React.CSSProperties = { paddingRight: 20 }

const monoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
  fontSize: 12.5,
}

const pillStyle = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '3px 10px',
  borderRadius: 999,
  fontSize: 11.5,
  fontWeight: 600,
  background: bg,
  color,
  whiteSpace: 'nowrap',
})

const sharedCss = `
  .sd-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .sd-summary-cell { display: flex; flex-direction: column; gap: 4px; padding: 16px 20px; min-width: 0; }
  .sd-summary-cell + .sd-summary-cell { border-left: 1px solid var(--border); }
  @media (max-width: 720px) {
    .sd-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sd-summary-cell:nth-child(3) { border-left: none; }
    .sd-summary-cell:nth-child(n + 3) { border-top: 1px solid var(--border); }
  }
  :root[data-ui="v2"] .v2-table tbody tr.sd-locked td { color: var(--foreground-muted); }
  :root[data-ui="v2"] .v2-table tbody tr.sd-total td { background: var(--surface-muted); border-bottom: none; }
`

const todayInputDate = () => new Date().toLocaleDateString('en-CA')

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface)',
  color: 'var(--foreground)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  display: 'block',
  marginBottom: 6,
}

interface PayTarget {
  id: number
  code: string
  outstanding: number
}

function PayModal({
  targets,
  supplierId,
  onClose,
}: {
  targets: PayTarget[]
  supplierId: number
  onClose: () => void
}) {
  const qc = useQueryClient()
  // Source of funds (Zahir's "Akun Kas"): the bank/cash account the money leaves.
  const [bankAccountId, setBankAccountId] = useState<number>(0)
  const [amounts, setAmounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(targets.map((t) => [t.id, t.outstanding])),
  )
  const totalAmount = targets.reduce((s, t) => s + Number(amounts[t.id] || 0), 0)
  const [date, setDate] = useState<string>(todayInputDate())
  const [description, setDescription] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data: bankData, isLoading: bankLoading } = useQuery({
    queryKey: ['bank-accounts-all', 'active', debouncedSearch],
    queryFn: () =>
      bankAccountsService
        .list({
          'filter[search]': debouncedSearch || undefined,
          per_page: 200,
          sort: 'bank_name',
          'filter[is_active]': true,
        } as any)
        .then((r) => r.data),
  })
  const bankAccounts: any[] = ((bankData as any)?.data ?? []).filter((b: any) => b.is_active !== false)
  const bankOptions = bankAccounts.map((b: any) => ({
    value: b.id as number,
    label: `${b.bank_name ?? 'Bank'} ${b.account_number ?? ''}`.trim(),
    sublabel: b.account_name ?? undefined,
  }))
  const selectedBank = bankAccounts.find((b: any) => b.id === bankAccountId)

  const mutation = useMutation({
    mutationFn: () =>
      paymentsService.create({
        type: 'disburse',
        date,
        payments: [
          {
            bank_account_id: bankAccountId,
            amount: totalAmount,
            description: description || undefined,
            allocations: targets
              .filter((t) => Number(amounts[t.id] || 0) > 0)
              .map((t) => ({ purchase_order_id: t.id, amount: Number(amounts[t.id]) })),
          },
        ],
      } as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-debt-detail-payments', supplierId] })
      qc.invalidateQueries({ queryKey: ['supplier-debt-detail-pos', supplierId] })
      qc.invalidateQueries({ queryKey: ['po-disburse-payments'] })
      qc.invalidateQueries({ queryKey: ['po-payments-history'] })
      qc.invalidateQueries({ queryKey: ['po-payments-pos'] })
      qc.invalidateQueries({ queryKey: ['supplier-debts-pos'] })
      toast.success('Pembayaran berhasil dicatat')
      onClose()
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal mencatat pembayaran'),
  })

  const handleSubmit = () => {
    if (bankAccountId === 0) {
      toast.error('Pilih akun kas/bank sumber dana')
      return
    }
    if (targets.some((t) => Number(amounts[t.id] || 0) > t.outstanding) || !(totalAmount > 0)) {
      toast.error('Jumlah pembayaran tidak valid')
      return
    }
    mutation.mutate()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} onClick={onClose} />
      <div
        style={{
          position: 'relative',
          width: 440,
          maxWidth: 'calc(100vw - 32px)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>
              {targets.length > 1 ? `Bayar ${targets.length} Invoice` : 'Bayar Invoice'}
            </div>
            {targets.length === 1 && (
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--foreground-muted)', marginTop: 2 }}>{targets[0].code}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>

          <div>
            <label style={labelStyle}>Akun Kas/Bank *</label>
            <SearchableSelect
              value={bankAccountId}
              onChange={(v) => setBankAccountId(Number(v))}
              options={bankOptions}
              placeholder="Pilih akun bank..."
              searchPlaceholder="Cari bank / no. rekening..."
              loading={bankLoading}
              onSearchChange={setSearch}
            />
            {selectedBank && !selectedBank.chart_of_account_id && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--warning)' }}>
                Akun bank ini belum punya Chart of Account. Atur dulu di Bank Accounts.
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Jumlah per Invoice *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {targets.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: 'var(--foreground)' }}>{t.code}</div>
                    <div style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                      Sisa: {formatCurrency(t.outstanding)}
                    </div>
                  </div>
                  <LocalizedNumberInput
                    value={amounts[t.id] ?? 0}
                    onChange={(v) => {
                      let x = v
                      if (x > t.outstanding) {
                        x = t.outstanding
                        toast.warning('Jumlah dibatasi sampai sisa hutang')
                      }
                      setAmounts((prev) => ({ ...prev, [t.id]: x }))
                    }}
                    decimals={2}
                    padDecimals={false}
                    placeholder="0"
                    style={{ width: 160, background: 'var(--surface-raised)' }}
                  />
                </div>
              ))}
            </div>
            {targets.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 13, fontWeight: 700 }}>
                <span>Total Pembayaran</span>
                <span style={{ color: 'var(--accent)' }}>{formatCurrency(totalAmount)}</span>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Tanggal *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Keterangan</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--foreground)', fontSize: 13, cursor: 'pointer' }}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            style={{
              padding: '9px 16px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'white',
              fontSize: 13,
              fontWeight: 600,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? 'Menyimpan...' : 'Simpan Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SupplierDebtDetailView({ mode = 'report' }: { mode?: SupplierDebtsMode }) {
  const router = useRouter()
  const supplierId = Number(router.query.id)
  // Filter buyer dari halaman Kartu Hutang (?buyer_id=).
  const buyerId = Number(router.query.buyer_id) || 0
  const [payTargets, setPayTargets] = useState<PayTarget[] | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const { user, hasPermission, isSuperadmin } = useAuth()
  const activeBranchName = ((user as any)?.branch?.name as string | undefined) ?? ''
  const canRead = isSuperadmin || hasPermission('report.read') || hasPermission('purchase-order.read')
  // The accounting copy is a report only; payments are recorded from the
  // Purchase Orders › Kartu Hutang Supplier page.
  const canPay = mode === 'purchase' && (isSuperadmin || hasPermission('payment.create'))
  // Warehouse / production read the company's debts (?branch_id= narrows), but
  // pay only their own branch's POs: a payment is recorded at the PO's branch.
  const { isCentral, activeBranchId, scopeParams } = useCentralCompanyScope()
  const branchId = isCentral ? Number(router.query.branch_id) || 0 : 0
  const isOwnPo = (po: PurchaseOrder) => !isCentral || po.branch_id === activeBranchId

  const { data: supplierData, isLoading: supplierLoading } = useQuery({
    queryKey: ['supplier-debt-detail-supplier', supplierId],
    enabled: canRead && !!supplierId,
    queryFn: () => suppliersService.findById(supplierId).then((r) => r.data),
  })

  const { data: posData, isLoading: posLoading } = useQuery({
    queryKey: ['supplier-debt-detail-pos', supplierId, buyerId, branchId, scopeParams.scope],
    enabled: canRead && !!supplierId,
    // Only unpaid POs, filtered on the server (filter[payment_status] is an exact
    // match, so one request per status) and paged through meta.last_page instead
    // of relying on a per_page cap.
    queryFn: async () => {
      const lists = await Promise.all(
        ['pending', 'partial'].map((paymentStatus) =>
          fetchAllPages((page) =>
            purchaseOrdersService
              .list({
                page,
                per_page: 200,
                sort: '-created_at',
                'filter[type]': 'supplier',
                'filter[supplier_id]': supplierId,
                'filter[payment_status]': paymentStatus,
                'filter[buyer_id]': buyerId > 0 ? buyerId : undefined,
                'filter[branch_id]': branchId > 0 ? branchId : undefined,
                include: 'supplier,purchase_order_details',
                ...scopeParams,
              } as any)
              .then((r) => r.data),
          ),
        ),
      )
      return lists.flat()
    },
  })

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['supplier-debt-detail-payments', supplierId, scopeParams.scope],
    enabled: canRead && !!supplierId,
    // GET /payments has no supplier filter (payment_query_request.go), so page
    // through every disburse payment and keep the ones allocated to this
    // supplier's POs below.
    queryFn: () =>
      fetchAllPages((page) =>
        paymentsService
          .list({
            page,
            per_page: 200,
            sort: '-date',
            'filter[type]': 'disburse',
            'filter[is_reversed]': 'false',
            include: 'allocations,payment_method,bank_account',
            ...scopeParams,
          } as any)
          .then((r) => r.data),
      ),
  })

  const supplier: Supplier | undefined = (supplierData as any)?.data
  const pos: PurchaseOrder[] = (posData as any[]) ?? []
  // Allocations only carry the PO id; show the PO code when it is loaded here.
  const poCodeById = new Map<number, string>((pos as any[]).filter((po) => po?.code).map((po) => [Number(po.id), String(po.code)]))
  const payments: DisbursePayment[] = (paymentsData as any[]) ?? []

  // Paid / outstanding come straight from the PO (total_payment /
  // remaining_payment) instead of summing a capped payments list.
  const poRows = useMemo(() => {
    return pos
      .filter((po) => !NON_PAYABLE_PO_STATUSES.includes(String(po.status ?? '')))
      .map((po) => {
        const totalPaid = Number(po.total_payment ?? 0)
        const outstanding =
          po.remaining_payment != null
            ? Number(po.remaining_payment)
            : Number(po.total_price ?? 0) - totalPaid
        return { ...po, totalPaid, outstanding }
      })
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => (parseApiDate(a.date)?.getTime() ?? 0) - (parseApiDate(b.date)?.getTime() ?? 0))
  }, [pos])

  const supplierPayments = useMemo(() => {
    return payments
      .filter((p) => !p.is_reversed)
      .filter((p) => p.allocations?.some((a) => a.purchase_order_id != null && poRows.some((row) => row.id === a.purchase_order_id)))
      .sort((a, b) => (parseApiDate(b.date ?? b.created_at)?.getTime() ?? 0) - (parseApiDate(a.date ?? a.created_at)?.getTime() ?? 0))
  }, [payments, poRows])

  const totalOutstanding = useMemo(() => poRows.reduce((sum, row) => sum + row.outstanding, 0), [poRows])

  const selectedRows = poRows.filter((r) => selected.has(r.id))
  const payableRows = poRows.filter(isOwnPo)
  const allSelected = payableRows.length > 0 && selectedRows.length === payableRows.length
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toPayTarget = (r: { id: number; code: string; outstanding: number }): PayTarget => ({
    id: r.id,
    code: r.code,
    outstanding: r.outstanding,
  })

  const isLoading = supplierLoading || posLoading || paymentsLoading

  const totalPaidAll = poRows.reduce((sum, row) => sum + row.totalPaid, 0)
  const oldestDate = poRows[0]?.date
  // Invoices this branch can't pay (they belong to another branch's PO).
  const lockedRows = poRows.filter((r) => !isOwnPo(r))
  const lockedBranchNames = Array.from(new Set(lockedRows.map((r) => r.branch?.name).filter(Boolean))) as string[]
  const showSelect = canPay && payableRows.length > 0
  const colCount = 8 + (showSelect ? 1 : 0)

  const backHref = `${supplierDebtsBasePath(mode)}${(() => {
    const qs = new URLSearchParams({
      ...(buyerId > 0 ? { buyer_id: String(buyerId) } : {}),
      ...(branchId > 0 ? { branch_id: String(branchId) } : {}),
    }).toString()
    return qs ? `?${qs}` : ''
  })()}`

  const exportExcel = () => {
    if (!supplier) return
    const today = new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD (not UTC)
    downloadExcel(`kartu-hutang-${supplier.code || supplier.id}-${today}.xlsx`, [
      {
        name: 'Invoice Belum Lunas',
        cols: [6, 20, 14, 18, 18, 18, 22],
        rows: [
          ...reportHeader({
            title: 'Kartu Hutang Supplier',
            branch: activeBranchName || undefined,
            extra: [`Supplier : ${supplier.name}${supplier.code ? ` (${supplier.code})` : ''}`],
          }),
          ['No', 'No. PO', 'Tanggal', 'Total', 'Dibayar', 'Sisa', ...(isCentral ? ['Cabang'] : [])],
          ...poRows.map((r, i) => [
            i + 1,
            r.code,
            r.date ? formatDate(r.date) : '',
            money(r.total_price),
            money(r.totalPaid),
            money(r.outstanding),
            ...(isCentral ? [r.branch?.name ?? ''] : []),
          ]),
          ['', 'Total', '', money(poRows.reduce((s, r) => s + Number(r.total_price ?? 0), 0)), money(totalPaidAll), money(totalOutstanding)],
        ],
      },
      {
        name: 'Riwayat Pembayaran',
        cols: [6, 14, 22, 28, 18, 40],
        rows: [
          ['No', 'Tanggal', 'No. Pembayaran', 'Kas/Bank', 'Jumlah', 'PO yang Dibayar'],
          ...supplierPayments.map((p, i) => [
            i + 1,
            formatDate(p.date ?? p.created_at),
            p.payment_number ?? `PMT-${p.id}`,
            p.bank_account
              ? `${p.bank_account.bank_name ?? 'Bank'} ${p.bank_account.account_number ?? ''}`.trim()
              : p.payment_method?.name ?? '',
            money(p.amount),
            (p.allocations ?? [])
              .filter((a) => a.purchase_order_id != null)
              .map((a) => `${poCodeById.get(Number(a.purchase_order_id)) ?? `PO #${a.purchase_order_id}`} (${Number(a.amount).toLocaleString('id-ID')})`)
              .join(', '),
          ]),
        ],
      },
    ])
  }

  if (!canRead) {
    return (
      <div style={containerStyle}>
        <div className="v2-card" style={{ padding: 16, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          You do not have permission to view supplier debt details.
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <style>{sharedCss}</style>

      {/* Back link — keeps the list's buyer/branch filter */}
      <BackLink href={backHref} label="Kartu Hutang Supplier" />

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginTop: 14 }}>
        <div style={{ minWidth: 0 }}>
          {supplierLoading ? (
            <div className="v2-skeleton" style={{ width: 220, height: 22 }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: 0, color: 'var(--foreground)' }}>
                {supplier?.name ?? 'Supplier'}
              </h1>
              {mode === 'report' && <span style={pillStyle('var(--foreground-muted)', 'var(--surface-muted)')}>Laporan</span>}
            </div>
          )}
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '6px 0 0' }}>
            {supplier?.code ? (
              <>Kode <span style={{ ...monoStyle, color: 'var(--foreground)' }}>{supplier.code}</span></>
            ) : '—'}
            {supplier?.phone ? <> · Telp <span style={{ color: 'var(--foreground)' }}>{supplier.phone}</span></> : null}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="v2-btn" onClick={exportExcel} disabled={isLoading || !supplier}>
          <Download size={15} /> Export Excel
        </button>
        {showSelect && (
          <button
            type="button"
            className="v2-btn v2-btn-primary"
            disabled={selectedRows.length === 0}
            title={selectedRows.length === 0 ? 'Centang invoice yang ingin dibayar' : undefined}
            onClick={() => setPayTargets(selectedRows.map(toPayTarget))}
          >
            <Wallet size={15} />
            {selectedRows.length > 0 ? `Bayar Terpilih (${selectedRows.length})` : 'Bayar Terpilih'}
          </button>
        )}
        </div>
      </div>

      {/* Summary */}
      <div className="v2-card sd-summary" style={{ marginTop: 20, overflow: 'hidden' }}>
        {[
          { label: 'Total Hutang', value: formatCurrency(totalOutstanding), color: 'var(--destructive)' },
          { label: 'Invoice Belum Lunas', value: poRows.length.toLocaleString('id-ID'), color: 'var(--foreground)' },
          { label: 'Sudah Dibayar', value: formatCurrency(totalPaidAll), color: 'var(--success)' },
          { label: 'Invoice Terlama', value: oldestDate ? formatDate(oldestDate) : '—', color: 'var(--foreground)' },
        ].map((s) => (
          <div key={s.label} className="sd-summary-cell">
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>{s.label}</span>
            {isLoading ? (
              <div className="v2-skeleton" style={{ width: '70%', height: 16 }} />
            ) : (
              <span style={{ fontSize: 15, fontWeight: 600, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
            )}
          </div>
        ))}
      </div>

      {/* Why some invoices can't be selected */}
      {canPay && !isLoading && lockedRows.length > 0 && (
        <div
          className="v2-card"
          style={{ marginTop: 16, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--info-bg)', borderColor: 'var(--info)', fontSize: 13, color: 'var(--foreground)' }}
        >
          <Info size={16} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }} />
          <div>
            {lockedRows.length === poRows.length ? 'Invoice di sini' : `${lockedRows.length} invoice`} milik
            {' '}<strong>{lockedBranchNames.join(', ') || 'cabang lain'}</strong>, jadi hanya bisa dibayar dari cabang tersebut.
            {' '}Ganti cabang aktif{activeBranchName ? <> (sekarang <strong>{activeBranchName}</strong>)</> : null} ke cabang pemilik PO untuk mencatat pembayaran.
          </div>
        </div>
      )}

      {/* Outstanding invoices */}
      <div className="v2-card" style={{ marginTop: 16, overflow: 'hidden' }}>
        <div style={cardHeaderStyle}>
          <h2 style={cardTitleStyle}>Invoice Belum Lunas</h2>
          <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>
            {showSelect && selectedRows.length > 0 ? `${selectedRows.length} dipilih · ` : ''}
            {poRows.length} invoice
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="v2-skeleton" style={{ height: 14, width: `${90 - i * 15}%` }} />
            ))}
          </div>
        ) : poRows.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <AlertCircle size={28} style={{ color: 'var(--foreground-subtle)', margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Tidak ada invoice belum lunas</div>
            <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', marginTop: 2 }}>
              Semua purchase order untuk supplier ini sudah lunas.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="v2-table">
              <thead>
                <tr>
                  {showSelect && (
                    <th style={{ ...thStyle, ...edgeL, width: 44 }}>
                      <input
                        type="checkbox"
                        aria-label="Pilih semua invoice"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(payableRows.map((r) => r.id)))}
                      />
                    </th>
                  )}
                  <th style={{ ...thStyle, ...(showSelect ? {} : edgeL), width: 44 }}>#</th>
                  <th style={thStyle}>No. PO</th>
                  <th style={thStyle}>Tanggal</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Dibayar</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Sisa</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, ...edgeR, width: canPay ? 120 : 48 }} />
                </tr>
              </thead>
              <tbody>
                {poRows.map((row, rowIdx) => {
                  const own = isOwnPo(row)
                  const badge = row.totalPaid > 0
                    ? { label: 'Sebagian', color: 'var(--warning)', bg: 'var(--warning-bg)' }
                    : { label: 'Belum Bayar', color: 'var(--destructive)', bg: 'var(--destructive-bg)' }
                  const age = daysSince(row.date)
                  return (
                    <tr
                      key={row.id}
                      data-row
                      className={own ? undefined : 'sd-locked'}
                      style={{ cursor: showSelect && own ? 'pointer' : undefined }}
                      onClick={showSelect && own ? () => toggleOne(row.id) : undefined}
                    >
                      {showSelect && (
                        <td style={{ ...tdStyle, ...edgeL }} onClick={(e) => e.stopPropagation()}>
                          {own ? (
                            <input type="checkbox" aria-label={`Pilih ${row.code}`} checked={selected.has(row.id)} onChange={() => toggleOne(row.id)} />
                          ) : (
                            <span title={`Dibayar oleh ${row.branch?.name ?? 'cabang pemilik PO'}`} style={{ display: 'inline-flex', color: 'var(--foreground-subtle)' }}>
                              <Lock size={13} />
                            </span>
                          )}
                        </td>
                      )}
                      <td style={{ ...tdStyle, ...(showSelect ? {} : edgeL), fontSize: 12, color: 'var(--foreground-subtle)' }}>{rowIdx + 1}</td>
                      <td style={tdStyle}>
                        {own ? (
                          <Link
                            href={`/purchase/purchase-orders/${row.id}/detail`}
                            className="v2-link"
                            style={{ ...monoStyle, fontWeight: 600 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.code}
                            <ArrowUpRight size={12} />
                          </Link>
                        ) : (
                          <span style={{ ...monoStyle, fontWeight: 600, color: 'var(--foreground)' }}>{row.code}</span>
                        )}
                        {isCentral && row.branch?.name && (
                          <div style={{ fontSize: 11.5, color: 'var(--foreground-subtle)', marginTop: 2 }}>{row.branch.name}</div>
                        )}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        {row.date ? formatDate(row.date) : '—'}
                        {age != null && (
                          <div style={{ fontSize: 11.5, marginTop: 2, color: age > 60 ? 'var(--destructive)' : age > 30 ? 'var(--warning)' : 'var(--foreground-subtle)' }}>
                            {age} hari
                          </div>
                        )}
                      </td>
                      <td style={amountTdStyle}>{formatCurrency(row.total_price)}</td>
                      <td style={{ ...amountTdStyle, color: row.totalPaid > 0 ? 'var(--success)' : 'var(--foreground-subtle)' }}>
                        {formatCurrency(row.totalPaid)}
                      </td>
                      <td style={{ ...amountTdStyle, fontWeight: 600 }}>{formatCurrency(row.outstanding)}</td>
                      <td style={tdStyle}>
                        <span style={pillStyle(badge.color, badge.bg)}>{badge.label}</span>
                      </td>
                      <td style={{ ...tdStyle, ...edgeR, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        {canPay && own ? (
                          <button type="button" className="v2-btn v2-btn-outline v2-btn-sm" onClick={() => setPayTargets([toPayTarget(row)])}>
                            <Wallet size={13} />
                            Bayar
                          </button>
                        ) : canPay ? (
                          <span style={{ fontSize: 11.5, color: 'var(--foreground-subtle)', whiteSpace: 'nowrap' }}>Cabang lain</span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
                <tr className="sd-total">
                  <td colSpan={colCount - 3} style={{ ...tdStyle, ...edgeL, fontWeight: 600 }}>Total Sisa Hutang</td>
                  <td style={{ ...amountTdStyle, fontWeight: 700, color: 'var(--destructive)' }}>{formatCurrency(totalOutstanding)}</td>
                  <td colSpan={2} style={tdStyle} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment history */}
      <div className="v2-card" style={{ marginTop: 16, overflow: 'hidden' }}>
        <div style={cardHeaderStyle}>
          <h2 style={cardTitleStyle}>Riwayat Pembayaran</h2>
          <span style={{ fontSize: 12.5, color: 'var(--foreground-muted)' }}>{supplierPayments.length} pembayaran</span>
        </div>

        {isLoading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[0, 1].map((i) => (
              <div key={i} className="v2-skeleton" style={{ height: 14, width: `${80 - i * 20}%` }} />
            ))}
          </div>
        ) : supplierPayments.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center' }}>
            <Receipt size={28} style={{ color: 'var(--foreground-subtle)', margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: 0 }}>Belum ada pembayaran untuk invoice-invoice ini</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="v2-table">
              <thead>
                <tr>
                  <th style={{ ...thStyle, ...edgeL, width: 44 }}>#</th>
                  <th style={thStyle}>Tanggal</th>
                  <th style={thStyle}>No. Pembayaran</th>
                  <th style={thStyle}>Kas/Bank</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Jumlah</th>
                  <th style={{ ...thStyle, ...edgeR }}>PO yang Dibayar</th>
                </tr>
              </thead>
              <tbody>
                {supplierPayments.map((p, pIdx) => (
                  <tr key={p.id}>
                    <td style={{ ...tdStyle, ...edgeL, fontSize: 12, color: 'var(--foreground-subtle)' }}>{pIdx + 1}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{p.date ? formatDate(p.date) : formatDate(p.created_at)}</td>
                    <td style={{ ...tdStyle, ...monoStyle }}>{p.payment_number ?? `PMT-${p.id}`}</td>
                    <td style={tdStyle}>
                      {p.bank_account
                        ? `${p.bank_account.bank_name ?? 'Bank'} ${p.bank_account.account_number ?? ''}`.trim()
                        : p.payment_method?.name ?? '—'}
                    </td>
                    <td style={{ ...amountTdStyle, fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(p.amount)}</td>
                    <td style={{ ...tdStyle, ...edgeR }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {(p.allocations ?? [])
                          .filter((a) => a.purchase_order_id != null)
                          .map((a, idx) => (
                            <span key={idx} style={{ fontSize: 12.5 }}>
                              <ReferenceLink type="purchase_orders" id={a.purchase_order_id}>
                                {poCodeById.get(Number(a.purchase_order_id)) ?? 'Purchase order'}
                                <span style={{ color: 'var(--foreground-muted)', fontWeight: 400 }}> · {formatCurrency(a.amount)}</span>
                              </ReferenceLink>
                            </span>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {payTargets && (
        <PayModal
          targets={payTargets}
          supplierId={supplierId}
          onClose={() => {
            setPayTargets(null)
            setSelected(new Set())
          }}
        />
      )}
    </div>
  )
}

function daysSince(date?: string): number | null {
  if (!date) return null
  // API dates are DD-MM-YYYY; new Date() would misread them.
  const t = parseApiDate(date)?.getTime()
  if (t == null || Number.isNaN(t)) return null
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}
