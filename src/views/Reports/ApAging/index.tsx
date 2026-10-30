'use client'

import React, { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { toast } from 'sonner'
import api from '@/hooks/useApi'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/utils/price'
import { formatDate, toInputDate } from '@/utils/date'
import { FileSpreadsheet, Download, Printer } from 'lucide-react'

interface ApAgingLine {
  supplier_name?: string | null
  code?: string
  date?: string
  age_days?: number
  bucket?: string
  outstanding?: number
}

interface ApAgingBuckets {
  bucket_0_30?: number
  bucket_31_60?: number
  bucket_61_90?: number
  bucket_90_plus?: number
  [key: string]: number | undefined
}

interface ApAging {
  as_of_date?: string
  buckets?: ApAgingBuckets
  lines?: ApAgingLine[]
  grand_total_outstanding?: number
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 24,
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  color: 'var(--foreground)',
  background: 'var(--surface-raised)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}

const btnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 16px',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--foreground)',
  cursor: 'pointer',
}

const bucketCardStyle: React.CSSProperties = {
  flex: '1 1 160px',
  padding: '14px 16px',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const bucketLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const bucketValueStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--foreground)',
  fontVariantNumeric: 'tabular-nums',
}

const theadCellStyle: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
}

const cellStyle: React.CSSProperties = {
  padding: '10px 16px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
}

const amountCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const totalRowStyle: React.CSSProperties = {
  background: 'var(--accent-light-bg)',
}

const totalCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--foreground)',
}

const totalAmountCellStyle: React.CSSProperties = {
  padding: '12px 16px',
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--accent)',
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const today = () => new Date().toISOString().split('T')[0]

const BUCKET_CARDS: { key: string; label: string }[] = [
  { key: '0_30', label: '0–30 hari' },
  { key: '31_60', label: '31–60 hari' },
  { key: '61_90', label: '61–90 hari' },
  { key: '90_plus', label: '> 90 hari' },
]

function getBucketValue(buckets: ApAgingBuckets | undefined, key: string): number {
  if (!buckets) return 0
  return Number(buckets[`bucket_${key}`] ?? buckets[key] ?? 0)
}

function bucketDisplayLabel(bucket: string | undefined): string {
  switch (bucket) {
    case '0_30':
      return '0–30'
    case '31_60':
      return '31–60'
    case '61_90':
      return '61–90'
    case '90_plus':
      return '> 90'
    default:
      return bucket ?? '—'
  }
}

export default function ApAgingView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('journal.read')

  const [asOfDate, setAsOfDate] = useState<string>(today())

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ap-aging', asOfDate],
    enabled: canRead && !!asOfDate,
    queryFn: () =>
      api.get('/reports/ap-aging', { params: { as_of_date: asOfDate } }).then((r) => r.data),
  })

  const ap: ApAging | undefined = (data as any)?.data

  const lines = ap?.lines ?? []
  const buckets = ap?.buckets ?? {}
  const grandTotal = Number(ap?.grand_total_outstanding ?? 0)

  const hasStatement = !isLoading && !isError && !!ap
  const canExport = hasStatement

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportApAging({ as_of_date: asOfDate }),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `ap-aging-${asOfDate}.xlsx`)
    },
    onError: () => {
      toast.error('Gagal mengekspor data.')
    }
  })

  const handleExport = () => {
    exportExcel()
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 15mm; }
          body { font-size: 11px; margin: 0; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #000; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 500,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Accounts Payable Aging
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            {hasStatement
              ? `Per tanggal ${formatDate(ap?.as_of_date ?? asOfDate)}`
              : 'Outstanding purchase orders grouped by age, as of a selected date'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => window.print()} style={btnStyle}>
            <Printer size={14} />
            Print
          </button>
          <button type="button" onClick={handleExport} disabled={!canExport || isExporting} style={{ ...btnStyle, opacity: canExport && !isExporting ? 1 : 0.6, cursor: canExport && !isExporting ? 'pointer' : 'not-allowed' }}>
            <Download size={14} />
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {!canRead ? (
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          You do not have permission to view the AP aging report.
        </div>
      ) : (
        <>
          {/* Date filter */}
          <div className="no-print" style={sectionStyle}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>As of Date</label>
                <input
                  type="date"
                  value={toInputDate(asOfDate)}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '10px 0 0' }}>
              Mencakup semua PO yang belum lunas sampai tanggal ini, termasuk dari periode sebelumnya. Pembayaran
              setelah tanggal ini tidak mengurangi saldo. Kolom bucket adalah rincian total berdasarkan umur, bukan filter.
            </p>
          </div>

          {/* Bucket summary strip */}
          {hasStatement && (
            <div style={sectionStyle}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {BUCKET_CARDS.map((b) => (
                  <div key={b.key} style={bucketCardStyle}>
                    <span style={bucketLabelStyle}>{b.label}</span>
                    <span style={bucketValueStyle}>{formatCurrency(getBucketValue(buckets, b.key))}</span>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Grand Total Outstanding</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Aged table */}
          <div style={sectionStyle}>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <FileSpreadsheet size={16} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Statement</span>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={theadCellStyle}>Supplier</th>
                    <th style={theadCellStyle}>No. PO</th>
                    <th style={theadCellStyle}>Tanggal</th>
                    <th style={theadCellStyle}>Umur (hari)</th>
                    <th style={theadCellStyle}>Bucket</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Loading...
                      </td>
                    </tr>
                  ) : isError ? (
                    <tr>
                      <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--destructive)' }}>
                        Failed to load AP aging report
                      </td>
                    </tr>
                  ) : !hasStatement ? (
                    <tr>
                      <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Select a date to generate the report
                      </td>
                    </tr>
                  ) : lines.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>
                        Tidak ada hutang tertunggak
                      </td>
                    </tr>
                  ) : (
                    <>
                      {lines.map((ln, idx) => {
                        const overdue = ln.bucket === '90_plus'
                        const rowStyle: React.CSSProperties = overdue ? { background: 'rgba(192, 54, 44, 0.06)' } : {}
                        return (
                          <tr key={`${ln.code ?? 'row'}-${idx}`} style={rowStyle}>
                            <td style={cellStyle}>{ln.supplier_name || '—'}</td>
                            <td style={cellStyle}>{ln.code ?? '—'}</td>
                            <td style={cellStyle}>{ln.date ? formatDate(ln.date) : '—'}</td>
                            <td style={cellStyle}>{ln.age_days ?? 0} hari</td>
                            <td style={{ ...cellStyle, color: overdue ? '#c0362c' : 'var(--foreground)', fontWeight: overdue ? 600 : 400 }}>
                              {bucketDisplayLabel(ln.bucket)}
                            </td>
                            <td style={amountCellStyle}>{formatCurrency(ln.outstanding ?? 0)}</td>
                          </tr>
                        )
                      })}
                      <tr style={totalRowStyle}>
                        <td colSpan={5} style={totalCellStyle}>
                          Grand Total
                        </td>
                        <td style={totalAmountCellStyle}>{formatCurrency(grandTotal)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
