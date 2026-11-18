'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useRouter } from 'next/router'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, Inbox, Loader2 } from 'lucide-react'
import { FilterBar, DateRange, countActive } from '@/components/ListFilters'
import { salesOrdersService } from '@/services/sales-orders.service'
import { formatCurrency } from '@/utils/price'
import { formatDateShort } from '@/utils/date'
import { CustomPagination } from '@/components/ui/CustomPagination'

/**
 * Credit Orders — every sale that is owed rather than paid at the counter,
 * by type, with the outlet's stages first and accounting's last:
 *
 *   Online Order    : Menunggu Payout → Sudah Settle (marketplace payout)
 *   Kredit Karyawan : Belum Dibayar → Menunggu Potong Gaji → Sudah Settle
 *   Kredit Customer : Belum Dibayar → Menunggu Setor → Lunas
 *
 * Settling (payouts, deposits, payroll) is done by accounting under
 * Accounting › Settlements; this list is where the outlet follows its credit.
 */

type CreditType = 'online' | 'user' | 'customer'

interface StageDef {
  key: string
  label: string
  hint: string
  params: Record<string, string>
  tone: 'warning' | 'info' | 'success'
}

const UNPAID = { 'filter[payment_statuses]': 'pending,partial' }

const TYPES: { key: CreditType; label: string; base: Record<string, string>; stages: StageDef[] }[] = [
  {
    key: 'online',
    label: 'Online Order',
    base: { 'filter[type]': 'online', 'filter[status]': 'final' },
    stages: [
      { key: 'pending', label: 'Menunggu Payout', hint: 'Dibayar ke marketplace, menunggu dana masuk.', params: { 'filter[settlement_status]': 'pending' }, tone: 'warning' },
      { key: 'settled', label: 'Sudah Settle', hint: 'Payout sudah dicatat accounting.', params: { 'filter[settlement_status]': 'settled' }, tone: 'success' },
    ],
  },
  {
    key: 'user',
    label: 'Kredit Karyawan',
    base: { 'filter[type]': 'offline', 'filter[credit_type]': 'user', 'filter[status]': 'final' },
    stages: [
      { key: 'unpaid', label: 'Belum Dibayar', hint: 'Belum dipotong dari kredit karyawan.', params: UNPAID, tone: 'warning' },
      { key: 'awaiting', label: 'Menunggu Potong Gaji', hint: 'Sudah dipotong dari kredit karyawan, menunggu accounting memotong gaji.', params: { 'filter[payment_status]': 'paid', 'filter[funds_status]': 'awaiting_settlement' }, tone: 'info' },
      { key: 'done', label: 'Sudah Settle', hint: 'Sudah dipotong dari gaji.', params: { 'filter[payment_status]': 'paid', 'filter[funds_status]': 'cleared' }, tone: 'success' },
    ],
  },
  {
    key: 'customer',
    label: 'Kredit Customer',
    base: { 'filter[type]': 'offline', 'filter[credit_type]': 'customer', 'filter[status]': 'final' },
    stages: [
      { key: 'unpaid', label: 'Belum Dibayar', hint: 'Customer belum melunasi (termasuk DP).', params: UNPAID, tone: 'warning' },
      { key: 'awaiting', label: 'Menunggu Setor', hint: 'Sudah dibayar di outlet, dana belum disetor ke bank.', params: { 'filter[payment_status]': 'paid', 'filter[funds_status]': 'awaiting_settlement' }, tone: 'info' },
      { key: 'done', label: 'Lunas', hint: 'Lunas dan dana sudah masuk.', params: { 'filter[payment_status]': 'paid', 'filter[funds_status]': 'cleared' }, tone: 'success' },
    ],
  },
]

const TONE: Record<StageDef['tone'], { color: string; bg: string }> = {
  warning: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  info: { color: 'var(--info)', bg: 'var(--info-bg)' },
  success: { color: 'var(--success)', bg: 'var(--success-bg)' },
}

const thStyle: CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  background: 'var(--background)',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'middle',
}

const tabStyle = (active: boolean): CSSProperties => ({
  padding: '10px 14px',
  border: 'none',
  borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
  background: 'none',
  color: active ? 'var(--foreground)' : 'var(--foreground-muted)',
  fontSize: 13,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

const chipStyle = (active: boolean): CSSProperties => ({
  height: 30,
  padding: '0 12px',
  borderRadius: 999,
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  background: active ? 'var(--accent-light-bg)' : 'var(--surface)',
  color: active ? 'var(--accent)' : 'var(--foreground-muted)',
  fontSize: 12.5,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

export default function CreditOrdersView() {
  const router = useRouter()

  const [type, setType] = useState<CreditType>('online')
  const typeDef = TYPES.find((t) => t.key === type)!
  const [stageKey, setStageKey] = useState(typeDef.stages[0].key)
  const stage = typeDef.stages.find((s) => s.key === stageKey) ?? typeDef.stages[0]

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  const pickType = (next: CreditType) => {
    setType(next)
    setStageKey(TYPES.find((t) => t.key === next)!.stages[0].key)
    setPage(1)
  }

  const filtersFor = (st: StageDef) => ({
    ...typeDef.base,
    ...st.params,
    ...(debouncedSearch ? { 'filter[search]': debouncedSearch } : {}),
    ...(dateFrom ? { 'filter[date_gte]': dateFrom } : {}),
    ...(dateTo ? { 'filter[date_lte]': dateTo } : {}),
  })

  const { data, isLoading: firstLoad, isFetching, isError } = useQuery({
    queryKey: ['credit-orders', type, stage.key, page, perPage, debouncedSearch, dateFrom, dateTo],
    queryFn: () =>
      salesOrdersService
        .list({ sort: '-date', include: 'customer,branch,sales_channel,credit_by', ...filtersFor(stage), page, per_page: perPage } as any)
        .then((r) => r.data),
  })
  const isLoading = firstLoad || isFetching
  const items: any[] = (data as any)?.data ?? []
  const meta = (data as any)?.meta

  const partyOf = (o: any) => {
    if (type === 'online') return o.sales_channel?.name ?? '—'
    if (type === 'user') return o.credit_by?.name ?? '—'
    return o.customer?.name || o.customer_name || '—'
  }
  const partyLabel = type === 'online' ? 'Channel' : type === 'user' ? 'Karyawan' : 'Customer'
  const remainingOf = (o: any) =>
    o.remaining_payment != null
      ? Number(o.remaining_payment)
      : Number(o.total_price ?? 0) - Number(o.returned_amount ?? 0) - Number(o.total_payment ?? 0)
  const tone = TONE[stage.tone]
  const colCount = 7

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: 'var(--foreground)' }}>Credit Orders</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground-muted)' }}>
          Order online, kredit karyawan dan kredit customer yang belum lunas atau belum di-settle. Settlement dicatat accounting di Accounting › Settlements.
        </p>
      </div>

      <div role="tablist" aria-label="Jenis kredit" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {TYPES.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={type === t.key} onClick={() => pickType(t.key)} style={tabStyle(type === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="Status" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {typeDef.stages.map((st) => (
          <button
            key={st.key}
            type="button"
            role="tab"
            aria-selected={stage.key === st.key}
            onClick={() => { setStageKey(st.key); setPage(1) }}
            style={chipStyle(stage.key === st.key)}
          >
            {st.label}
            {/* Only the shown list is fetched (one request per click), so only its total is known. */}
            {stage.key === st.key && meta?.total != null && <span style={{ marginLeft: 6, opacity: 0.75 }}>{meta.total}</span>}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>{stage.hint}</span>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari kode atau customer…"
        activeCount={countActive(dateFrom, dateTo)}
        onClear={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
        quick={
          <div style={{ maxWidth: '100%' }}>
            <DateRange inline from={dateFrom} to={dateTo} onFromChange={(v) => { setDateFrom(v); setPage(1) }} onToChange={(v) => { setDateTo(v); setPage(1) }} />
          </div>
        }
        actions={
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {isFetching && !isLoading && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
            {meta?.total != null ? `${meta.total} order` : ''}
          </span>
        }
      />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 170 }}>Order</th>
                <th style={{ ...thStyle, width: 110 }}>Tanggal</th>
                <th style={thStyle}>{partyLabel}</th>
                <th style={{ ...thStyle, width: 130, textAlign: 'right' }}>Total</th>
                <th style={{ ...thStyle, width: 130, textAlign: 'right' }}>Dibayar</th>
                <th style={{ ...thStyle, width: 130, textAlign: 'right' }}>Sisa</th>
                <th style={{ ...thStyle, width: 170 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    {Array.from({ length: colCount }).map((__, c) => (
                      <td key={c} style={tdStyle}>
                        <div style={{ height: 12, borderRadius: 4, background: 'var(--background)' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--destructive)' }}>
                    Gagal memuat order
                  </td>
                </tr>
              )}
              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={colCount} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--foreground-muted)' }}>
                      <Inbox size={28} color="var(--foreground-subtle)" />
                      <span style={{ fontSize: 14 }}>Tidak ada order {typeDef.label.toLowerCase()} — {stage.label.toLowerCase()}</span>
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading &&
                !isError &&
                items.map((o: any) => (
                  <tr key={o.id}>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => router.push(`/sales/sales-orders/${o.id}/detail`)}
                        style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--accent)', textAlign: 'left' }}
                      >
                        <span className="v2-link">{o.code}<ArrowUpRight size={12} /></span>
                      </button>
                      {o.branch?.name && <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>{o.branch.name}</div>}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>{formatDateShort(o.date)}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{partyOf(o)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{formatCurrency(Number(o.total_price ?? 0))}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--foreground-muted)' }}>{formatCurrency(Number(o.total_payment ?? 0))}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: remainingOf(o) > 0 ? 'var(--destructive)' : 'var(--foreground-muted)' }}>
                      {formatCurrency(Math.max(0, remainingOf(o)))}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-flex', height: 22, alignItems: 'center', padding: '0 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: tone.color, background: tone.bg }}>
                        {o.payment_status === 'partial' && stage.key === 'unpaid' ? 'DP / Sebagian' : stage.label}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {meta && <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />}
    </div>
  )
}
