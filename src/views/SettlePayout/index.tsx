'use client'

import HeaderCheckbox from '@/components/HeaderCheckbox'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileSpreadsheet, Inbox, Loader2, Undo2, X, ArrowUpRight } from 'lucide-react'
import { salesOrdersService } from '@/services/sales-orders.service'
import { salesChannelsService } from '@/services/sales-channels.service'
import { branchesService } from '@/services/branches.service'
import { BranchOptionGroups } from '@/lib/branchOptions'
import { bankAccountsService } from '@/services/bank-accounts.service'
import { paymentsService } from '@/services/payments.service'
import { toastMutationApiError } from '@/utils/apiError'
import { formatCurrency } from '@/utils/price'
import { formatDateShort, toInputDate } from '@/utils/date'
import { downloadExcel, money, reportHeader, type ExcelRow } from '@/utils/excelExport'
import { CustomPagination } from '@/components/ui/CustomPagination'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import SearchableSelect from '@/components/SearchableSelect'
import { useAuth } from '@/hooks/useAuth'

const today = () => new Date().toLocaleDateString('en-CA')

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

const fieldErrorStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--destructive)',
  marginTop: 4,
}

/** Pickup points settle together with their outlet. */
const outletKeyOf = (order: any): number | null => {
  const b = order?.branch
  if (!b) return order?.branch_id ?? null
  return b.format === 'pickup_point' && b.parent_id ? Number(b.parent_id) : Number(b.id)
}

const outstandingOf = (order: any): number => {
  const remaining = order?.remaining_payment
  if (remaining !== undefined && remaining !== null) return Number(remaining)
  return Math.max(0, Number(order?.total_price ?? 0) - Number(order?.total_payment ?? 0))
}

/** Every order paid by the same payout as `orderId` (from its receive payment). */
export async function resolvePayoutOrderIds(orderId: number): Promise<number[]> {
  const allocRes = await paymentsService.listAllocations({
    per_page: 50,
    sort: '-id',
    'filter[sales_order_id]': orderId,
    'filter[is_reversed]': 'false',
  })
  const allocations: any[] = (allocRes.data as any)?.data ?? []
  const paymentId = allocations[0]?.payment_id
  if (!paymentId) return [orderId]
  const payRes = await paymentsService.findById(Number(paymentId), { include: 'allocations' })
  const payment = (payRes.data as any)?.data
  const ids: number[] = (payment?.allocations ?? [])
    .map((a: any) => Number(a.sales_order_id))
    .filter((id: number) => id > 0)
  return ids.length > 0 ? Array.from(new Set(ids)) : [orderId]
}

type Tab = 'pending' | 'settled'

export default function SettlePayoutView() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  // The menu only needs sales-order.menu; settling and undoing call the
  // bulk-update-settlement endpoint, so those controls need its permission.
  const canSettle = hasPermission('sales-order.bulk-update-settlement-status')
  const qc = useQueryClient()

  const [tab, setTab] = useState<Tab>('pending')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(50)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [channelId, setChannelId] = useState<number | ''>('')
  const [branchId, setBranchId] = useState<number | ''>('')
  const [dateGte, setDateGte] = useState('')
  const [dateLte, setDateLte] = useState('')

  // Selected orders keyed by id — kept across pages so the totals stay right.
  const [selected, setSelected] = useState<Map<number, any>>(new Map())
  const [receivedAmount, setReceivedAmount] = useState<number | undefined>(undefined)
  const [bankAccountId, setBankAccountId] = useState<number>(0)
  const [payoutDate, setPayoutDate] = useState(today())
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [undoTarget, setUndoTarget] = useState<{ order: any; ids: number[] } | null>(null)
  const [resolvingUndoId, setResolvingUndoId] = useState<number | null>(null)

  // ?tab=settled&search=CODE — deep link from the sales order "Return" error.
  useEffect(() => {
    if (!router.isReady) return
    if (router.query.tab === 'settled') setTab('settled')
    if (typeof router.query.search === 'string') setSearch(router.query.search)
  }, [router.isReady, router.query.tab, router.query.search])

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [tab, searchDebounced, channelId, branchId, dateGte, dateLte])

  const { data: channelsData } = useQuery({
    queryKey: ['settle-payout-channels'],
    queryFn: () =>
      salesChannelsService
        .list({ per_page: 100, sort: 'name', 'filter[sales_order_type]': 'online' })
        .then((r) => r.data),
  })
  const onlineChannels: any[] = ((channelsData as any)?.data ?? []).filter(
    (c: any) => !c.sales_order_type || c.sales_order_type === 'online',
  )

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'settle-payout', 'with-company'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name', include: 'company' } as any).then((r) => r.data),
  })
  const branches: any[] = (branchesData as any)?.data ?? []

  // The marketplace transfer lands in one of our Kas/Bank accounts, the same
  // question Settle Payments asks for card money.
  const { data: banksData, isLoading: banksLoading } = useQuery({
    queryKey: ['bank-accounts-all', 'active'],
    queryFn: () =>
      bankAccountsService.list({ per_page: 200, sort: 'bank_name', 'filter[is_active]': true } as any).then((r) => r.data),
  })
  const bankAccounts: any[] = ((banksData as any)?.data ?? []).filter((b: any) => b.is_active !== false)

  const listFilters = {
    sort: '-date',
    include: 'branch,sales_channel',
    'filter[type]': 'online',
    'filter[settlement_status]': tab === 'pending' ? 'pending' : 'settled',
    'filter[search]': searchDebounced || undefined,
    'filter[sales_channel_id]': channelId || undefined,
    'filter[branch_id]': branchId || undefined,
    'filter[date_gte]': dateGte || undefined,
    'filter[date_lte]': dateLte || undefined,
  }

  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: [
      'settle-payout-orders', tab, page, perPage, searchDebounced, channelId, branchId, dateGte, dateLte,
    ],
    queryFn: () =>
      salesOrdersService
        .list({ ...listFilters, page, per_page: perPage } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching
  const rawItems: any[] = (data as any)?.data ?? []
  // "Pending" here means waiting for payout: unpaid orders only.
  const items = tab === 'pending' ? rawItems.filter((o) => o.payment_status !== 'paid') : rawItems
  const meta = (data as any)?.meta

  const selectedOrders = useMemo(() => Array.from(selected.values()), [selected])
  const anchor = selectedOrders[0]
  const totalOutstanding = selectedOrders.reduce((s, o) => s + outstandingOf(o), 0)
  const received = Number(receivedAmount ?? 0)
  const fee = totalOutstanding - received
  const latestOrderDate = selectedOrders
    .map((o) => toInputDate(o.date))
    .filter(Boolean)
    .sort()
    .pop()

  const canSelect = (order: any) => {
    if (!anchor || selected.has(Number(order.id))) return true
    return (
      Number(order.sales_channel_id) === Number(anchor.sales_channel_id) &&
      outletKeyOf(order) === outletKeyOf(anchor)
    )
  }

  const toggle = (order: any) => {
    const id = Number(order.id)
    if (!canSelect(order)) {
      toast.error('Satu payout hanya untuk satu sales channel dan satu outlet.')
      return
    }
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(id)) next.delete(id)
      else next.set(id, order)
      return next
    })
    setFieldErrors({})
  }

  // Check-all: one payout covers one sales channel + one outlet, so it acts on the
  // shown pending orders of the selected group (or of the first row's group when
  // nothing is selected yet).
  const groupBase = anchor ?? items[0]
  const bulkGroup =
    tab === 'pending' && groupBase
      ? items.filter(
          (o) =>
            Number(o.sales_channel_id) === Number(groupBase.sales_channel_id) &&
            outletKeyOf(o) === outletKeyOf(groupBase),
        )
      : []
  const toggleAll = (checkAll: boolean) => {
    setSelected((prev) => {
      const next = new Map(prev)
      for (const o of bulkGroup) checkAll ? next.set(Number(o.id), o) : next.delete(Number(o.id))
      return next
    })
    setFieldErrors({})
    if (checkAll && bulkGroup.length < items.length) {
      toast.info('Hanya order dengan sales channel dan outlet yang sama yang dipilih — satu payout untuk satu channel dan satu outlet.')
    }
  }

  const resetForm = () => {
    setSelected(new Map())
    setReceivedAmount(undefined)
    setBankAccountId(0)
    setPayoutDate(today())
    setDescription('')
    setFieldErrors({})
  }

  const { mutate: submitPayout, isPending: submitting } = useMutation({
    mutationFn: () =>
      salesOrdersService.bulkUpdateSettlement({
        payouts: [
          {
            sales_order_ids: selectedOrders.map((o) => Number(o.id)),
            bank_account_id: bankAccountId,
            received_amount: received,
            date: payoutDate,
            description: description.trim() || undefined,
          },
        ],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settle-payout-orders'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(`Payout dicatat untuk ${selectedOrders.length} order`)
      resetForm()
    },
    onError: (err: any) => {
      // 422 keys: payouts.0.received_amount, payouts.0.date, ...
      const errors = err?.response?.data?.errors
      if (errors && typeof errors === 'object') {
        const mapped: Record<string, string> = {}
        Object.entries(errors).forEach(([k, v]) => {
          const field = k.replace(/\[(\d+)\]/g, '.$1').replace(/^payouts\.\d+\./, '')
          mapped[field] = String(Array.isArray(v) ? v[0] : v)
        })
        setFieldErrors(mapped)
      }
      toastMutationApiError(err, 'Gagal mencatat payout')
    },
  })

  const handleSubmit = () => {
    if (selectedOrders.length === 0) return toast.error('Pilih minimal satu order')
    if (!bankAccountId) return toast.error('Pilih akun Kas/Bank tujuan')
    if (!(received > 0)) return toast.error('Isi jumlah yang diterima')
    if (received > totalOutstanding) {
      return toast.error('Jumlah diterima tidak boleh melebihi total outstanding')
    }
    if (!payoutDate) return toast.error('Isi tanggal payout')
    if (latestOrderDate && payoutDate < latestOrderDate) {
      return toast.error('Tanggal payout tidak boleh sebelum tanggal order')
    }
    submitPayout()
  }

  const { mutate: undoPayout, isPending: undoing } = useMutation({
    mutationFn: (ids: number[]) =>
      salesOrdersService.bulkUpdateSettlement({
        items: ids.map((id) => ({ sales_order_id: id, settlement_status: 'pending' })),
      }),
    onSuccess: (_res, ids) => {
      qc.invalidateQueries({ queryKey: ['settle-payout-orders'] })
      qc.invalidateQueries({ queryKey: ['sales-orders'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
      toast.success(`Payout dibatalkan — ${ids.length} order kembali pending`)
      setUndoTarget(null)
    },
    onError: (err: any) => toastMutationApiError(err, 'Gagal membatalkan payout'),
  })

  const startUndo = async (order: any) => {
    setResolvingUndoId(Number(order.id))
    try {
      const ids = await resolvePayoutOrderIds(Number(order.id))
      setUndoTarget({ order, ids })
    } catch (err: any) {
      toastMutationApiError(err, 'Gagal memuat payout order ini')
    } finally {
      setResolvingUndoId(null)
    }
  }

  const branchName = (order: any) =>
    order.branch?.name ?? branches.find((b) => Number(b.id) === Number(order.branch_id))?.name ?? '—'

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      style={{
        padding: '8px 16px',
        fontSize: 13,
        fontWeight: 600,
        border: 'none',
        borderBottom: `2px solid ${tab === value ? 'var(--accent)' : 'transparent'}`,
        background: 'none',
        color: tab === value ? 'var(--accent)' : 'var(--foreground-muted)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  const colCount = canSettle ? 7 : 6

  // Exports every order of the current tab + filters (all pages).
  const [exporting, setExporting] = useState(false)
  const exportExcel = async () => {
    setExporting(true)
    try {
      const fetched = await salesOrdersService.listAll(listFilters)
      const all = tab === 'pending' ? fetched.filter((o) => o.payment_status !== 'paid') : fetched
      if (all.length === 0) {
        toast.info('Tidak ada order untuk diexport')
        return
      }
      const channelName = onlineChannels.find((c: any) => c.id === channelId)?.name
      const branchName = branches.find((b: any) => b.id === branchId)?.name
      const rows: ExcelRow[] = [
        ...reportHeader({
          title: `Online Order Settlements — ${tab === 'pending' ? 'Menunggu Payout' : 'Sudah Settle'}`,
          branch: branchName,
          period: dateGte || dateLte ? `${dateGte || '…'} – ${dateLte || '…'}` : undefined,
          extra: [
            ...(channelName ? [`Channel : ${channelName}`] : []),
            ...(searchDebounced ? [`Search : ${searchDebounced}`] : []),
          ],
        }),
        ['No', 'Kode', 'Tanggal', 'Channel', 'Outlet', 'Settlement', 'Total', tab === 'pending' ? 'Outstanding' : 'Dibayar'],
        ...all.map((o: any, i: number) => [
          i + 1,
          o.code,
          formatDateShort(o.date),
          o.sales_channel?.name ?? '',
          o.branch?.name ?? '',
          o.settlement_status ?? '',
          money(o.total_price),
          money(tab === 'pending' ? outstandingOf(o) : o.total_payment),
        ]),
        [],
        ['', '', '', '', '', 'Total',
          money(all.reduce((s: number, o: any) => s + Number(o.total_price ?? 0), 0)),
          money(all.reduce(
            (s: number, o: any) => s + (tab === 'pending' ? outstandingOf(o) : Number(o.total_payment ?? 0)),
            0,
          ))],
      ]
      downloadExcel(
        `unpaid-online-orders-${tab}-${new Date().toLocaleDateString('en-CA')}.xlsx`,
        [{ name: tab === 'pending' ? 'Menunggu Payout' : 'Sudah Settle', rows, cols: [5, 22, 12, 18, 20, 12, 14, 14] }],
      )
    } catch (err: any) {
      toastMutationApiError(err, 'Gagal export Excel')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Online Order Settlements
        </h1>
        <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
          Catat pencairan dana marketplace (GoFood, Grab Food, Shopee Food) untuk order online yang masih pending
        </p>
        </div>
        <button
          type="button"
          onClick={exportExcel}
          disabled={exporting}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px',
            border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)',
            color: 'var(--foreground)', fontSize: 13, fontWeight: 500, cursor: exporting ? 'wait' : 'pointer',
            opacity: exporting ? 0.6 : 1,
          }}
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
          Export Excel
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {tabButton('pending', 'Menunggu Payout')}
        {tabButton('settled', 'Sudah Settle')}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode order..."
          style={{ ...controlStyle, width: 220 }}
        />
        <select
          value={channelId}
          onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : '')}
          style={{ ...controlStyle, width: 180 }}
        >
          <option value="">Semua channel online</option>
          {onlineChannels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : '')}
          style={{ ...controlStyle, width: 200 }}
        >
          <option value="">Semua outlet</option>
          <BranchOptionGroups branches={branches} label={(b: any) => b.name} getValue={(b) => b.id} />
        </select>
        <input type="date" value={dateGte} onChange={(e) => setDateGte(e.target.value)} style={controlStyle} />
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--foreground-muted)' }}>s/d</span>
        <input type="date" value={dateLte} onChange={(e) => setDateLte(e.target.value)} style={controlStyle} />
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Orders table */}
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {canSettle && (
                    <th style={{ ...thStyle, width: 40 }}>
                      {tab === 'pending' && (
                        <HeaderCheckbox
                          total={bulkGroup.length}
                          checkedCount={bulkGroup.filter((o) => selected.has(Number(o.id))).length}
                          onToggleAll={toggleAll}
                          title="Pilih semua order (channel dan outlet yang sama)"
                        />
                      )}
                    </th>
                  )}
                  <th style={thStyle}>Kode</th>
                  <th style={thStyle}>Tanggal</th>
                  <th style={thStyle}>Channel</th>
                  <th style={thStyle}>Outlet</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>
                    {tab === 'pending' ? 'Outstanding' : canSettle ? 'Aksi' : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: colCount }).map((__, j) => (
                        <td key={j} style={tdStyle}>
                          <div
                            style={{
                              height: 14,
                              borderRadius: 'var(--radius-sm)',
                              background: 'var(--background)',
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', color: 'var(--destructive)' }}>
                      Gagal memuat order.
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                      <Inbox size={28} color="var(--foreground-subtle)" />
                      <div style={{ fontSize: 14, color: 'var(--foreground-muted)', marginTop: 8 }}>
                        {tab === 'pending'
                          ? 'Tidak ada order online yang menunggu payout.'
                          : 'Belum ada order online yang sudah di-settle.'}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((order) => {
                    const id = Number(order.id)
                    const checked = selected.has(id)
                    const selectable = canSelect(order)
                    return (
                      <tr
                        key={id}
                        style={{
                          background: checked ? 'var(--accent-light-bg)' : undefined,
                          opacity: tab === 'pending' && !selectable ? 0.45 : 1,
                        }}
                      >
                        {canSettle && (
                        <td style={tdStyle}>
                          {tab === 'pending' && (
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!selectable}
                              onChange={() => toggle(order)}
                              style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
                            />
                          )}
                        </td>
                        )}
                        <td style={tdStyle}>
                          <button
                            type="button"
                            onClick={() => router.push(`/sales/sales-orders/${id}/detail`)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: 'var(--accent)',
                              fontWeight: 600,
                              fontSize: 14,
                              cursor: 'pointer',
                            }}
                          >
                            <span className="v2-link">{order.code}<ArrowUpRight size={12} /></span>
                          </button>
                        </td>
                        <td style={tdStyle}>{formatDateShort(order.date)}</td>
                        <td style={tdStyle}>{order.sales_channel?.name ?? '—'}</td>
                        <td style={tdStyle}>{branchName(order)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(order.total_price)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          {tab === 'pending' ? (
                            formatCurrency(outstandingOf(order))
                          ) : canSettle && (
                            <button
                              type="button"
                              onClick={() => startUndo(order)}
                              disabled={resolvingUndoId === id}
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
                                cursor: resolvingUndoId === id ? 'wait' : 'pointer',
                              }}
                            >
                              {resolvingUndoId === id ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Undo2 size={13} />
                              )}
                              Undo payout
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />
        </div>

        {/* Payout form */}
        {tab === 'pending' && canSettle && (
          <div
            style={{
              flex: '0 1 340px',
              minWidth: 280,
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0, color: 'var(--foreground)' }}>
                Payout
              </h2>
              {selectedOrders.length > 0 && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'none',
                    border: 'none',
                    color: 'var(--foreground-muted)',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} /> Reset
                </button>
              )}
            </div>

            <div style={{ fontSize: 13, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
              {anchor ? (
                <>
                  {selectedOrders.length} order · {anchor.sales_channel?.name ?? 'Channel'} · {branchName(anchor)}
                </>
              ) : (
                'Centang order dari satu laporan marketplace (satu channel, satu outlet).'
              )}
              {fieldErrors.sales_order_ids && <div style={fieldErrorStyle}>{fieldErrors.sales_order_ids}</div>}
            </div>

            <div>
              <label style={labelStyle}>Jumlah diterima *</label>
              <LocalizedNumberInput
                value={receivedAmount}
                onChange={(val) => {
                  setReceivedAmount(val)
                  setFieldErrors((e) => ({ ...e, received_amount: '' }))
                }}
                decimals={2}
                padDecimals={false}
                placeholder="0"
                error={!!fieldErrors.received_amount}
              />
              {fieldErrors.received_amount && <div style={fieldErrorStyle}>{fieldErrors.received_amount}</div>}
              {totalOutstanding > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Quick fill:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReceivedAmount(totalOutstanding)
                      setFieldErrors((e) => ({ ...e, received_amount: '' }))
                    }}
                    style={{
                      padding: '4px 10px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: 'var(--foreground-muted)',
                    }}
                  >
                    Outstanding (Rp {totalOutstanding.toLocaleString('id-ID')})
                  </button>
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Diterima di (Kas / Bank) *</label>
              <SearchableSelect
                value={bankAccountId}
                onChange={(val: any) => setBankAccountId(Number(val) || 0)}
                options={bankAccounts.map((b) => ({
                  value: Number(b.id),
                  label: `${b.bank_name ?? 'Bank'} ${b.account_number ?? ''}`.trim(),
                  sublabel: b.account_name || undefined,
                }))}
                placeholder="Pilih rekening tujuan"
                searchPlaceholder="Cari bank / no. rekening..."
                loading={banksLoading}
                error={fieldErrors.bank_account_id || undefined}
              />
            </div>

            <div>
              <label style={labelStyle}>Tanggal payout *</label>
              <input
                type="date"
                value={payoutDate}
                min={latestOrderDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                style={{ ...controlStyle, width: '100%', boxSizing: 'border-box' }}
              />
              {fieldErrors.date && <div style={fieldErrorStyle}>{fieldErrors.date}</div>}
            </div>

            <div>
              <label style={labelStyle}>Keterangan</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`${anchor?.sales_channel?.name ?? 'Channel'} payout`}
                style={{ ...controlStyle, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div
              style={{
                background: 'var(--background)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Total order</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(totalOutstanding)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--foreground-muted)' }}>Diterima</span>
                <span style={{ fontWeight: 600 }}>{formatCurrency(received)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--border)',
                  paddingTop: 6,
                }}
              >
                <span style={{ color: 'var(--foreground-muted)' }}>Fee marketplace</span>
                <span style={{ fontWeight: 700, color: fee < 0 ? 'var(--destructive)' : 'var(--warning)' }}>
                  {formatCurrency(fee)}
                </span>
              </div>
              {fee < 0 && (
                <div style={fieldErrorStyle}>Jumlah diterima melebihi total outstanding.</div>
              )}
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedOrders.length === 0}
              style={{
                height: 40,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background:
                  submitting || selectedOrders.length === 0 ? 'var(--foreground-subtle)' : 'var(--accent)',
                color: 'white',
                fontSize: 14,
                fontWeight: 600,
                cursor: submitting || selectedOrders.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Menyimpan...' : 'Settle Payout'}
            </button>
          </div>
        )}
      </div>

      {/* Undo payout confirm */}
      {undoTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            onClick={() => !undoing && setUndoTarget(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }}
          />
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
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: '0 0 8px', color: 'var(--foreground)' }}>
              Undo payout?
            </h3>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>
              Payout untuk <b>{undoTarget.order.code}</b> akan dibatalkan.{' '}
              {undoTarget.ids.length > 1
                ? `${undoTarget.ids.length} order dalam payout yang sama juga akan kembali pending dan belum dibayar.`
                : 'Order akan kembali pending dan belum dibayar.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setUndoTarget(null)}
                disabled={undoing}
                style={{
                  height: 36,
                  padding: '0 16px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => undoPayout(undoTarget.ids)}
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
                }}
              >
                {undoing ? 'Memproses...' : 'Undo payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
