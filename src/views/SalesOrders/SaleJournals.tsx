'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowUpRight, BookOpen, Loader2 } from 'lucide-react'
import { journalsService } from '@/services/accounting.service'
import { paymentsService } from '@/services/payments.service'
import { formatCurrency } from '@/utils/price'
import { formatDateShort } from '@/utils/date'

/*
 * Both journals of a sale, so the accountant sees the Piutang step:
 *   1. Sales journal   — D Piutang Dagang / K Pendapatan (+ HPP), referencing the order.
 *   2. Payment journal — D Kas/Bank (the method's account) / K Piutang, one per payment.
 *      A method that requires settlement posts nothing at payment: the amount
 *      stays in Piutang until Settle Payments posts D Bank (+ fee) / K Piutang.
 * /journals cannot filter by reference, so the sales journal is found by searching
 * the order code and keeping the journal whose reference is this order.
 */

const INCLUDE = 'journal_details,journal_details.chart_of_account'
const SALE_REFS = new Set(['sales_orders', 'sales_order', 'SalesOrder'])

function JournalBlock({ title, journal, note }: { title: string; journal: any; note?: string }) {
  const lines: any[] = [...(journal?.journal_details ?? [])].sort((a, b) => Number(b.debit ?? 0) - Number(a.debit ?? 0))
  const totalDebit = lines.reduce((a, l) => a + Number(l.debit ?? 0), 0)
  const totalCredit = lines.reduce((a, l) => a + Number(l.credit ?? 0), 0)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: 'var(--surface-muted, var(--background))', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--foreground)' }}>
          {title}
          {note && <span style={{ fontWeight: 400, color: 'var(--foreground-muted)' }}> · {note}</span>}
        </span>
        <a
          href={`/accounting/journals?search=${encodeURIComponent(journal?.journal_number ?? '')}`}
          target="_blank"
          rel="noopener"
          className="v2-link"
          style={{ fontSize: 12 }}
          title="Open in Journals"
        >
          {journal?.journal_number ?? `#${journal?.id}`}
          <ArrowUpRight size={11} />
        </a>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr>
            {['No.', 'Account', 'Debit', 'Credit'].map((h) => (
              <th key={h} style={{ padding: '6px 12px', width: h === 'No.' ? 50 : undefined, textAlign: h === 'No.' ? 'center' : h === 'Account' ? 'left' : 'right', fontSize: 11, fontWeight: 500, color: 'var(--foreground-muted)', borderBottom: '1px solid var(--border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const credit = Number(l.credit ?? 0) > 0
            return (
              <tr key={l.id ?? i}>
                <td style={{ padding: '6px 12px', textAlign: 'center', color: 'var(--foreground-muted)', width: 50 }}>{i + 1}</td>
                <td style={{ padding: '6px 12px', paddingLeft: credit ? 28 : 12, color: 'var(--foreground)' }}>
                  {l.chart_of_account ? (
                    <>
                      <span style={{ color: 'var(--foreground-muted)', fontVariantNumeric: 'tabular-nums' }}>{l.chart_of_account.code}</span> {l.chart_of_account.name}
                    </>
                  ) : (
                    `COA #${l.chart_of_account_id}`
                  )}
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{Number(l.debit ?? 0) > 0 ? formatCurrency(l.debit) : ''}</td>
                <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{credit ? formatCurrency(l.credit) : ''}</td>
              </tr>
            )
          })}
          <tr>
            <td style={{ padding: '6px 12px', borderTop: '1px solid var(--border)' }} />
            <td style={{ padding: '6px 12px', fontSize: 11.5, color: 'var(--foreground-muted)', borderTop: '1px solid var(--border)' }}>
              {formatDateShort(journal?.date)} {journal?.is_posted ? '· Posted' : '· Draft'}
              {journal?.is_reversed ? ' · Reversed' : ''}
            </td>
            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 500, borderTop: '1px solid var(--border)' }}>{formatCurrency(totalDebit)}</td>
            <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 500, borderTop: '1px solid var(--border)' }}>{formatCurrency(totalCredit)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export default function SaleJournals({
  order,
  payments,
  cardStyle,
  cardHeaderStyle,
  cardTitleStyle,
}: {
  order: any
  payments: {
    id?: number
    journal_id?: number | null
    method?: string
    number?: string
    settlement_status?: 'pending' | 'settled' | null
    settlement_id?: number | null
  }[]
  cardStyle: React.CSSProperties
  cardHeaderStyle: React.CSSProperties
  cardTitleStyle: React.CSSProperties
}) {
  const orderId = Number(order?.id)
  const code: string = order?.code ?? ''

  const { data: salesJournalData, isLoading: salesLoading } = useQuery({
    queryKey: ['sale-journal', orderId, code],
    enabled: !!orderId && !!code,
    queryFn: () =>
      journalsService
        .list({ per_page: 20, include: INCLUDE, 'filter[search]': code } as any)
        .then((r) => r.data),
  })
  const salesJournals: any[] = ((salesJournalData as any)?.data ?? []).filter(
    (j: any) => SALE_REFS.has(String(j.reference_type)) && Number(j.reference_id) === orderId,
  )

  const journalIds = Array.from(new Set(payments.map((p) => Number(p.journal_id)).filter((v) => v > 0))).sort((a, b) => a - b)
  const { data: paymentJournals = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['sale-payment-journals', journalIds],
    enabled: journalIds.length > 0,
    queryFn: () =>
      Promise.all(
        journalIds.map((jid) =>
          journalsService
            .findById(jid, { include: INCLUDE })
            .then((r) => (r.data as any)?.data ?? null)
            .catch(() => null),
        ),
      ),
  })

  // Settled payments: their journal belongs to the settlement (one per batch).
  const settlementIds = Array.from(new Set(payments.map((p) => Number(p.settlement_id)).filter((v) => v > 0))).sort((a, b) => a - b)
  const { data: settlementJournals = [], isLoading: settlementsLoading } = useQuery({
    queryKey: ['sale-payment-journals', 'settlements', settlementIds],
    enabled: settlementIds.length > 0,
    queryFn: () =>
      Promise.all(
        settlementIds.map((sid) =>
          paymentsService
            .findSettlement(sid)
            .then((r) => (r.data as any)?.data ?? null)
            .then((st: any) =>
              st?.journal_id
                ? journalsService
                    .findById(Number(st.journal_id), { include: INCLUDE })
                    .then((r) => ({ settlement: st, journal: (r.data as any)?.data ?? null }))
                : { settlement: st, journal: null },
            )
            .catch(() => null),
        ),
      ),
  })

  const loading =
    salesLoading || (journalIds.length > 0 && paymentsLoading) || (settlementIds.length > 0 && settlementsLoading)
  const paymentRows = payments.filter((p) => Number(p.journal_id) > 0)
  const pendingRows = payments.filter((p) => p.settlement_status === 'pending' && !(Number(p.journal_id) > 0))
  const settledRows = (settlementJournals as any[]).filter((x) => x?.journal)

  return (
    <section style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={cardTitleStyle}>Journals</span>
          <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>Sale → Piutang → Payment</span>
        </div>
        <BookOpen size={15} style={{ color: 'var(--foreground-subtle)' }} />
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--foreground-muted)' }}>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Looking for journals…
          </div>
        ) : (
          <>
            {salesJournals.length > 0 ? (
              salesJournals.map((j) => <JournalBlock key={j.id} title="1. Sales journal" journal={j} note="Piutang ← Pendapatan" />)
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--foreground-subtle)' }}>1. Sales journal: not found (the order may not be final yet).</div>
            )}
            {pendingRows.map((p, i) => (
              <div
                key={`pending-${p.id ?? i}`}
                style={{
                  fontSize: 12.5,
                  color: 'var(--warning)',
                  background: 'var(--warning-bg)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 12px',
                }}
              >
                2. {[p.method, p.number].filter(Boolean).join(' · ') || 'Payment'}: menunggu settlement — masih di Piutang Dagang
                sampai dana masuk bank (Payment Settlements → Offline Orders).
              </div>
            ))}
            {settledRows.map((x: any) => (
              <JournalBlock
                key={`settle-${x.journal.id}`}
                title="2. Settlement journal"
                journal={x.journal}
                note={[x.settlement?.code, 'Bank ← Piutang'].filter(Boolean).join(' · ')}
              />
            ))}
            {paymentRows.length === 0 ? (
              pendingRows.length === 0 && settledRows.length === 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--foreground-subtle)' }}>
                  2. Payment journal: none yet. A Credit payment has no payment journal; it stays on Piutang.
                </div>
              )
            ) : (
              paymentRows.map((p, i) => {
                const j = (paymentJournals as any[]).find((x) => x && Number(x.id) === Number(p.journal_id))
                return j ? (
                  <JournalBlock key={j.id} title={`2. Payment journal${paymentRows.length > 1 ? ` (${i + 1})` : ''}`} journal={j} note={[p.method, p.number].filter(Boolean).join(' · ') || 'Kas/Bank ← Piutang'} />
                ) : (
                  <div key={p.journal_id ?? i} style={{ fontSize: 12.5, color: 'var(--foreground-subtle)' }}>
                    2. Payment journal #{p.journal_id}: could not be loaded.
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </section>
  )
}
