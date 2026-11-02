'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { reportsService, type ArAgingLine, type ArAgingParams, type ArAgingResponse } from '@/services/reports.service'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/utils/price'
import { formatDate } from '@/utils/date'
import { downloadExcel, money, reportHeader, type ExcelRow } from '@/utils/excelExport'

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
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
  whiteSpace: 'nowrap',
}

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
}

const amountCellStyle: React.CSSProperties = {
  ...cellStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

const totalCellStyle: React.CSSProperties = {
  padding: '12px 12px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--foreground)',
  background: 'var(--accent-light-bg)',
}

const totalAmountCellStyle: React.CSSProperties = {
  ...totalCellStyle,
  textAlign: 'right',
  color: 'var(--accent)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

const COLS = 9

const today = () => new Date().toISOString().split('T')[0]

const BUCKET_CARDS: { key: 'bucket_0_30' | 'bucket_31_60' | 'bucket_61_90' | 'bucket_90_plus'; label: string }[] = [
  { key: 'bucket_0_30', label: '0–30 hari' },
  { key: 'bucket_31_60', label: '31–60 hari' },
  { key: 'bucket_61_90', label: '61–90 hari' },
  { key: 'bucket_90_plus', label: '> 90 hari' },
]

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

function sourceLabel(type: string): string {
  return type === 'invoice' ? 'Invoice' : type === 'sales_order' ? 'Kredit POS' : type
}

function sourceHref(ln: ArAgingLine): string | null {
  if (ln.source_type === 'invoice') return `/transfer/invoices/${ln.source_id}`
  if (ln.source_type === 'sales_order') return `/sales/sales-orders/${ln.source_id}/detail`
  return null
}

function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Backend tidak punya endpoint PDF untuk AR Aging, jadi PDF dibangun di FE
 * dari JSON: dokumen cetak terpisah dibuka di iframe tersembunyi lalu dialog
 * print browser dipanggil (pilih "Save as PDF").
 */
function printArAgingPdf(report: ArAgingResponse) {
  const period = report.start_date
    ? `${formatDate(report.start_date)} s/d ${formatDate(report.end_date)}`
    : `Semua piutang terbuka s/d ${formatDate(report.end_date)}`

  const rows = report.lines
    .map(
      (ln, i) => `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(sourceLabel(ln.source_type))}</td>
        <td>${escapeHtml(ln.code)}</td>
        <td>${escapeHtml(ln.customer_name || '—')}</td>
        <td>${escapeHtml(ln.date ? formatDate(ln.date) : '—')}</td>
        <td>${escapeHtml(ln.due_date ? formatDate(ln.due_date) : '—')}</td>
        <td class="r">${escapeHtml(formatCurrency(ln.total_price))}</td>
        <td class="r">${escapeHtml(formatCurrency(ln.total_payment))}</td>
        <td class="r">${escapeHtml(formatCurrency(ln.outstanding))}</td>
        <td class="c">${ln.age_days ?? 0}</td>
        <td class="c">${escapeHtml(bucketDisplayLabel(ln.bucket))}</td>
      </tr>`,
    )
    .join('')

  const bucketRows = BUCKET_CARDS.map(
    (b) => `<tr><td>${b.label}</td><td class="r">${escapeHtml(formatCurrency(report.buckets?.[b.key] ?? 0))}</td></tr>`,
  ).join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>AR Aging ${escapeHtml(report.end_date)}</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
      h1 { font-size: 16px; margin: 0 0 2px; }
      .muted { color: #555; margin: 0 0 12px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
      th { background: #eee; text-align: left; }
      .r { text-align: right; white-space: nowrap; }
      .c { text-align: center; }
      tfoot td { font-weight: bold; background: #f5f5f5; }
      .summary { width: 280px; margin-top: 14px; }
    </style></head><body>
    <h1>Accounts Receivable Aging</h1>
    <p class="muted">Periode: ${escapeHtml(period)}</p>
    <table>
      <thead><tr>
        <th>#</th><th>Sumber</th><th>No. Dokumen</th><th>Customer</th><th>Tanggal</th><th>Jatuh Tempo</th>
        <th class="r">Total</th><th class="r">Dibayar</th><th class="r">Outstanding</th><th class="c">Umur (hari)</th><th class="c">Bucket</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="11" class="c">Tidak ada piutang tertunggak</td></tr>'}</tbody>
      <tfoot><tr><td colspan="8">Grand Total Outstanding</td><td class="r">${escapeHtml(formatCurrency(report.grand_total_outstanding))}</td><td colspan="2"></td></tr></tfoot>
    </table>
    <table class="summary">
      <thead><tr><th>Bucket</th><th class="r">Outstanding</th></tr></thead>
      <tbody>${bucketRows}</tbody>
      <tfoot><tr><td>Total</td><td class="r">${escapeHtml(formatCurrency(report.grand_total_outstanding))}</td></tr></tfoot>
    </table>
  </body></html>`

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    toast.error('Gagal membuat PDF.')
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 1000)
  }, 250)
}

/**
 * Excel dibangun di FE dari JSON yang sama dengan tabel di layar
 * (backend tidak lagi punya endpoint export AR Aging).
 */
function exportArAgingExcel(report: ArAgingResponse, filename: string) {
  const period = report.start_date
    ? `${formatDate(report.start_date)} s/d ${formatDate(report.end_date)}`
    : `Semua piutang terbuka s/d ${formatDate(report.end_date)}`
  const totalPrice = report.lines.reduce((s, l) => s + Number(l.total_price ?? 0), 0)
  const totalPayment = report.lines.reduce((s, l) => s + Number(l.total_payment ?? 0), 0)

  const rows: ExcelRow[] = [
    ...reportHeader({ title: 'Accounts Receivable Aging', period }),
    ['Bucket', 'Outstanding'],
    ...BUCKET_CARDS.map((b) => [b.label, money(report.buckets?.[b.key] ?? 0)]),
    ['Grand Total Outstanding', money(report.grand_total_outstanding)],
    [],
    ['No', 'Sumber', 'No. Dokumen', 'Customer', 'Tanggal', 'Jatuh Tempo', 'Total', 'Dibayar', 'Outstanding', 'Umur (hari)', 'Bucket'],
    ...report.lines.map((ln, i) => [
      i + 1,
      sourceLabel(ln.source_type),
      ln.code,
      ln.customer_name || '',
      ln.date ? formatDate(ln.date) : '',
      ln.due_date ? formatDate(ln.due_date) : '',
      money(ln.total_price),
      money(ln.total_payment),
      money(ln.outstanding),
      ln.age_days ?? 0,
      bucketDisplayLabel(ln.bucket),
    ]),
    ['', '', '', '', '', 'Grand Total', money(totalPrice), money(totalPayment), money(report.grand_total_outstanding)],
  ]

  downloadExcel(filename, [
    { name: 'AR Aging', rows, cols: [24, 14, 28, 30, 12, 12, 16, 16, 16, 11, 8] },
  ])
}

export default function ArAgingView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = isSuperadmin || hasPermission('report.read')

  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>(today())

  // Backend membalas 400 bila start_date > end_date — cegah di FE.
  const rangeInvalid = !!startDate && !!endDate && startDate > endDate

  const params: ArAgingParams = {
    start_date: startDate || undefined,
    end_date: endDate || undefined,
  }

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ar-aging', startDate, endDate],
    enabled: canRead && !rangeInvalid,
    queryFn: () => reportsService.getArAging(params).then((r) => r.data),
  })

  const report: ArAgingResponse | undefined = (data as any)?.data
  const lines = report?.lines ?? []
  const grandTotal = Number(report?.grand_total_outstanding ?? 0)
  const totalPrice = lines.reduce((s, l) => s + Number(l.total_price ?? 0), 0)
  const totalPayment = lines.reduce((s, l) => s + Number(l.total_payment ?? 0), 0)
  const hasReport = !isLoading && !isError && !!report
  const errorMessage = (error as any)?.response?.data?.message ?? 'Gagal memuat laporan AR Aging'

  const exportExcel = () => {
    if (!report) return
    try {
      exportArAgingExcel(report, `ar-aging-${startDate ? `${startDate}_` : ''}${endDate || today()}.xlsx`)
    } catch {
      toast.error('Gagal mengekspor data.')
    }
  }

  const periodText = report
    ? report.start_date
      ? `Periode ${formatDate(report.start_date)} s/d ${formatDate(report.end_date)}`
      : `Semua piutang terbuka s/d ${formatDate(report.end_date)}`
    : 'Piutang invoice dan penjualan kredit POS, dikelompokkan berdasarkan umur'

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 500, color: 'var(--foreground)', margin: 0 }}>
            Accounts Receivable Aging
          </h1>
          <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>{periodText}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => report && printArAgingPdf(report)}
            disabled={!hasReport}
            style={{ ...btnStyle, opacity: hasReport ? 1 : 0.6, cursor: hasReport ? 'pointer' : 'not-allowed' }}
          >
            <FileText size={14} />
            Export PDF
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={!hasReport}
            style={{ ...btnStyle, opacity: hasReport ? 1 : 0.6, cursor: hasReport ? 'pointer' : 'not-allowed' }}
          >
            <Download size={14} />
            Export Excel
          </button>
        </div>
      </div>

      {!canRead ? (
        <div style={{ ...sectionStyle, color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'var(--warning)', fontSize: 13 }}>
          Anda tidak memiliki izin untuk melihat laporan AR Aging.
        </div>
      ) : (
        <>
          {/* Filter tanggal */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Start Date (opsional)</label>
                <input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>End Date</label>
                <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
              </div>
              {startDate && (
                <button type="button" onClick={() => setStartDate('')} style={btnStyle}>
                  Hapus Start Date
                </button>
              )}
            </div>
            <p style={{ fontSize: 12, color: rangeInvalid ? 'var(--destructive)' : 'var(--foreground-muted)', margin: '10px 0 0' }}>
              {rangeInvalid
                ? 'Start date tidak boleh setelah end date.'
                : 'Kosongkan start date untuk menampilkan semua piutang terbuka sampai end date. Umur dihitung per end date.'}
            </p>
          </div>

          {/* Ringkasan bucket */}
          {hasReport && (
            <div style={sectionStyle}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {BUCKET_CARDS.map((b) => (
                  <div key={b.key} style={bucketCardStyle}>
                    <span style={bucketLabelStyle}>{b.label}</span>
                    <span style={bucketValueStyle}>{formatCurrency(report?.buckets?.[b.key] ?? 0)}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Grand Total Outstanding</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Tabel */}
          <div style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <FileSpreadsheet size={16} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Rincian Piutang</span>
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={theadCellStyle}>No. Dokumen</th>
                    <th style={theadCellStyle}>Customer</th>
                    <th style={theadCellStyle}>Tanggal</th>
                    <th style={theadCellStyle}>Jatuh Tempo</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Total</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Dibayar</th>
                    <th style={{ ...theadCellStyle, textAlign: 'right' }}>Outstanding</th>
                    <th style={theadCellStyle}>Umur</th>
                    <th style={theadCellStyle}>Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeInvalid ? (
                    <tr>
                      <td colSpan={COLS} style={{ ...cellStyle, textAlign: 'center', color: 'var(--destructive)' }}>
                        Perbaiki rentang tanggal untuk memuat laporan
                      </td>
                    </tr>
                  ) : isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: COLS }).map((__, j) => (
                          <td key={j} style={cellStyle}>
                            <div style={{ height: 12, borderRadius: 4, background: 'var(--border)', opacity: 0.6 }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : isError ? (
                    <tr>
                      <td colSpan={COLS} style={{ ...cellStyle, textAlign: 'center', color: 'var(--destructive)' }}>
                        {errorMessage}
                      </td>
                    </tr>
                  ) : lines.length === 0 ? (
                    <tr>
                      <td colSpan={COLS} style={{ ...cellStyle, textAlign: 'center', color: 'var(--foreground-muted)', padding: 32 }}>
                        Tidak ada piutang tertunggak
                      </td>
                    </tr>
                  ) : (
                    <>
                      {lines.map((ln, idx) => {
                        const overdue = ln.bucket === '90_plus'
                        const href = sourceHref(ln)
                        return (
                          <tr key={`${ln.source_type}-${ln.source_id}-${idx}`} style={overdue ? { background: 'var(--destructive-bg)' } : undefined}>
                            <td style={cellStyle}>
                              {href ? (
                                <Link href={href} style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                                  {ln.code}
                                </Link>
                              ) : (
                                ln.code
                              )}
                              <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>{sourceLabel(ln.source_type)}</div>
                            </td>
                            <td style={cellStyle}>{ln.customer_name || '—'}</td>
                            <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{ln.date ? formatDate(ln.date) : '—'}</td>
                            <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{ln.due_date ? formatDate(ln.due_date) : '—'}</td>
                            <td style={amountCellStyle}>{formatCurrency(ln.total_price ?? 0)}</td>
                            <td style={amountCellStyle}>{formatCurrency(ln.total_payment ?? 0)}</td>
                            <td style={{ ...amountCellStyle, fontWeight: 600 }}>{formatCurrency(ln.outstanding ?? 0)}</td>
                            <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>{ln.age_days ?? 0} hari</td>
                            <td style={{ ...cellStyle, color: overdue ? 'var(--destructive)' : 'var(--foreground)', fontWeight: overdue ? 600 : 400, whiteSpace: 'nowrap' }}>
                              {bucketDisplayLabel(ln.bucket)}
                            </td>
                          </tr>
                        )
                      })}
                      <tr>
                        <td colSpan={4} style={totalCellStyle}>Grand Total</td>
                        <td style={totalAmountCellStyle}>{formatCurrency(totalPrice)}</td>
                        <td style={totalAmountCellStyle}>{formatCurrency(totalPayment)}</td>
                        <td style={totalAmountCellStyle}>{formatCurrency(grandTotal)}</td>
                        <td colSpan={2} style={totalCellStyle} />
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
