'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AxiosResponse } from 'axios'
import { toast } from 'sonner'
import { ArrowUpRight, ChevronLeft, ChevronRight, Download, Eye, FileText } from 'lucide-react'
import { downloadFileFromResponse } from '@/utils/file'
import { formatDate } from '@/utils/date'
import { formatCurrency } from '@/utils/price'

/**
 * Shared layout for the Supplier / Customer Statement reports: one-row filter
 * toolbar, aging summary, and the open documents as a v2 table (JSON from
 * GET /v1/reports/{supplier,customer}-statements). Export Excel calls the
 * matching /exports endpoint with the same filters.
 */

export interface StatementLine {
  key: string
  code: string
  date: string
  due_date: string | null
  party: string
  total: number
  paid: number
  outstanding: number
  age_days: number
  href?: string
}

export interface StatementData {
  asOf: string
  lines: StatementLine[]
  buckets: {
    bucket_current?: number
    bucket_0_30: number
    bucket_31_60: number
    bucket_61_90: number
    bucket_90_plus: number
  }
  total: number
}

const PAGE_SIZE = 50

async function errorMessage(err: any): Promise<string> {
  const data = err?.response?.data
  if (data instanceof Blob) {
    try {
      const json = JSON.parse(await data.text())
      if (json?.message) return json.message
    } catch {
      /* not JSON */
    }
  }
  return data?.message ?? err?.message ?? 'Gagal memuat data.'
}

export interface StatementReportProps<F> {
  title: string
  subtitle: string
  filename: string
  /** Column header for the supplier / customer name. */
  partyLabel: string
  /** Toolbar controls (name / customer, period, as-of date). */
  filters: React.ReactNode
  /** Current (draft) filter values; applied when the user clicks Tampilkan. */
  value: F
  /** Return an error message to block Tampilkan / Export, or null. */
  validate?: (value: F) => string | null
  /** Load automatically on first render (when the filters are valid). */
  autoLoad?: boolean
  fetchData: (value: F) => Promise<StatementData>
  fetchExport: (value: F) => Promise<AxiosResponse<Blob>>
  queryKey: string
  emptyHint: string
}

export default function StatementReport<F>({
  title,
  subtitle,
  filename,
  partyLabel,
  filters,
  value,
  validate,
  autoLoad,
  fetchData,
  fetchExport,
  queryKey,
  emptyHint,
}: StatementReportProps<F>) {
  const [applied, setApplied] = useState<F | null>(() => (autoLoad && !validate?.(value) ? value : null))
  const [page, setPage] = useState(1)

  const { data, isFetching, isError, error } = useQuery<StatementData>({
    queryKey: [queryKey, applied],
    enabled: applied != null,
    retry: false,
    queryFn: () => fetchData(applied as F),
  })

  const { mutate: exportExcel, isPending: exporting } = useMutation({
    mutationFn: () => fetchExport(value),
    onSuccess: (res) => downloadFileFromResponse(res, filename),
    onError: async (e) => toast.error(await errorMessage(e)),
  })

  const show = () => {
    const msg = validate?.(value)
    if (msg) return toast.error(msg)
    setApplied(value)
    setPage(1)
  }

  const onExport = () => {
    const msg = validate?.(value)
    if (msg) return toast.error(msg)
    exportExcel()
  }

  const lines = data?.lines ?? []
  const lastPage = Math.max(1, Math.ceil(lines.length / PAGE_SIZE))
  const pageLines = lines.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const loading = isFetching

  const columns: Array<{ label: string; align?: 'left' | 'right'; width?: number }> = [
    { label: 'No', align: 'right', width: 52 },
    { label: 'No. Dokumen' },
    { label: partyLabel },
    { label: 'Tanggal', width: 120 },
    { label: 'Jatuh Tempo', width: 120 },
    { label: 'Umur', align: 'right', width: 80 },
    { label: 'Total', align: 'right', width: 150 },
    { label: 'Dibayar', align: 'right', width: 150 },
    { label: 'Sisa', align: 'right', width: 150 },
  ]

  const summary = [
    { label: 'Total Outstanding', value: data?.total, strong: true },
    { label: 'Belum Jatuh Tempo', value: data?.buckets.bucket_current },
    { label: '0–30 hari', value: data?.buckets.bucket_0_30 },
    { label: '31–60 hari', value: data?.buckets.bucket_31_60 },
    { label: '61–90 hari', value: data?.buckets.bucket_61_90 },
    { label: '> 90 hari', value: data?.buckets.bucket_90_plus, danger: true },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 500, margin: 0, color: 'var(--foreground)', letterSpacing: '-0.02em' }}>{title}</h1>
        <p style={{ fontSize: 12.5, color: 'var(--foreground-muted)', margin: '2px 0 0 0' }}>{subtitle}</p>
      </div>

      {/* Toolbar: filters on the left, actions on the right — one row, wraps on narrow screens. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          show()
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
      >
        {filters}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button type="submit" className="v2-btn v2-btn-primary" disabled={loading}>
            <Eye size={15} /> {loading ? 'Memuat…' : 'Tampilkan'}
          </button>
          <button type="button" className="v2-btn" onClick={onExport} disabled={exporting}>
            <Download size={15} /> {exporting ? 'Mengekspor…' : 'Export Excel'}
          </button>
        </div>
      </form>

      {applied != null && !isError && (
        <div className="v2-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {summary.map((s, i) => (
            <div key={s.label} style={{ padding: '12px 16px', borderLeft: i > 0 ? '1px solid var(--border)' : undefined }}>
              <div style={{ fontSize: 11.5, color: 'var(--foreground-muted)' }}>
                {s.label}
                {i === 0 && data?.asOf ? <span style={{ color: 'var(--foreground-subtle)' }}> · per {formatDate(data.asOf)}</span> : null}
              </div>
              {loading || !data ? (
                <div className="v2-skeleton" style={{ height: 16, width: '60%', marginTop: 8 }} />
              ) : (
                <div
                  style={{
                    fontSize: s.strong ? 18 : 15,
                    fontWeight: 600,
                    marginTop: 4,
                    letterSpacing: '-0.01em',
                    fontVariantNumeric: 'tabular-nums',
                    color: s.danger && (s.value ?? 0) > 0 ? 'var(--destructive)' : 'var(--foreground)',
                  }}
                >
                  {formatCurrency(s.value ?? 0)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="v2-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="v2-table">
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th key={i} style={{ textAlign: c.align ?? 'left', width: c.width, whiteSpace: 'nowrap' }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, r) => (
                  <tr key={r}>
                    {columns.map((c, ci) => (
                      <td key={ci}>
                        <div className="v2-skeleton" style={{ height: 10, width: `${70 - ((r + ci) % 3) * 15}%`, marginLeft: c.align === 'right' ? 'auto' : undefined }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : applied == null || isError || lines.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ height: 'auto', padding: '56px 16px', textAlign: 'center' }}>
                    <FileText size={28} style={{ display: 'block', margin: '0 auto 8px', color: isError ? 'var(--destructive)' : 'var(--foreground-subtle)' }} />
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
                      {applied == null ? 'Pilih filter lalu klik Tampilkan' : isError ? 'Gagal memuat data' : 'Tidak ada tagihan terbuka'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                      {applied == null
                        ? emptyHint
                        : isError
                          ? (error as any)?.response?.data?.message ?? (error as Error)?.message
                          : 'Semua dokumen sudah lunas per tanggal ini.'}
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {pageLines.map((l, i) => (
                    <tr key={l.key}>
                      <td style={{ textAlign: 'right', color: 'var(--foreground-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12 }}>
                        {l.href ? (
                          <Link href={l.href} className="v2-link">
                            {l.code}
                            <ArrowUpRight size={12} />
                          </Link>
                        ) : (
                          l.code
                        )}
                      </td>
                      <td>{l.party || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(l.date)}</td>
                      <td style={{ whiteSpace: 'nowrap', color: l.due_date ? undefined : 'var(--foreground-subtle)' }}>
                        {l.due_date ? formatDate(l.due_date) : '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                          color: l.age_days > 90 ? 'var(--destructive)' : l.age_days > 30 ? 'var(--warning)' : 'var(--foreground-muted)',
                        }}
                      >
                        {l.age_days} hari
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(l.total)}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: l.paid > 0 ? 'var(--success)' : 'var(--foreground-subtle)' }}>
                        {formatCurrency(l.paid)}
                      </td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', fontWeight: 600 }}>{formatCurrency(l.outstanding)}</td>
                    </tr>
                  ))}
                  {page === lastPage && (
                    <tr style={{ background: 'var(--surface-muted)' }}>
                      <td colSpan={columns.length - 1} style={{ textAlign: 'right', fontWeight: 600 }}>Total</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(data?.total ?? 0)}</td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {!loading && lastPage > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 12.5, color: 'var(--foreground-muted)' }}>
            <span>
              {((page - 1) * PAGE_SIZE + 1).toLocaleString('id-ID')}–{Math.min(page * PAGE_SIZE, lines.length).toLocaleString('id-ID')} dari {lines.length.toLocaleString('id-ID')} dokumen
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" className="v2-btn v2-btn-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{page} / {lastPage}</span>
              <button type="button" className="v2-btn v2-btn-sm" aria-label="Next page" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
