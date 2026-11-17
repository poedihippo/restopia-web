'use client'

import React, { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import {
  bankReconciliationsService,
  type BankReconciliation,
  type StatementLineInput,
} from '@/services/bank-reconciliations.service'
import { columnFinder, findHeaderRow, isBlankCell, parseAmount, parseDateCell } from '@/utils/excelImport'
import { formatDate, toInputDate } from '@/utils/date'
import { toastMutationApiError } from '@/utils/apiError'
import { cardStyle, money, num, numCell, round2 } from './shared'

const TEMPLATE_SHEET = 'Rekening Koran'
const HEADERS = ['Tanggal', 'Keterangan', 'Referensi', 'Debet (uang keluar)', 'Kredit (uang masuk)', 'Saldo']

const DATE_ALIASES = ['tanggal', 'date', 'tgl', 'tanggaltransaksi', 'transactiondate', 'postdate', 'postingdate']
const DESC_ALIASES = ['keterangan', 'description', 'uraian', 'deskripsi', 'keterangantransaksi', 'remark', 'remarks']
const REF_ALIASES = ['referensi', 'reference', 'ref', 'noreferensi', 'nomorreferensi']
const OUT_ALIASES = ['debet', 'debit', 'mutasidebet', 'mutasidebit', 'db']
const IN_ALIASES = ['kredit', 'credit', 'mutasikredit', 'mutasicredit', 'cr']
const BAL_ALIASES = ['saldo', 'balance', 'saldoakhir', 'runningbalance']

/** dd/mm/yyyy of a yyyy-mm-dd date moved by `days`, kept inside [start, end]. */
function exampleDate(start: string, end: string, days: number): string {
  const base = start ? new Date(`${start}T00:00:00`) : new Date()
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days)
  if (end) {
    const last = new Date(`${end}T00:00:00`)
    if (d > last) d.setTime(last.getTime())
  }
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/** Sample statement rows for the Example file, with a running Saldo. */
function exampleRows(start: string, end: string, opening: number): (string | number)[][] {
  const sample: [number, string, string, number, number][] = [
    // [day offset, keterangan, referensi, debet (keluar), kredit (masuk)]
    [1, 'SETORAN TUNAI OUTLET', 'STR-0001', 0, 2500000],
    [3, 'TRSF E-BANKING DB - PEMBAYARAN SUPPLIER', 'TRF-0002', 1750000, 0],
    [7, 'PENCAIRAN EDC / QRIS', 'EDC-0003', 0, 3200000],
    [12, 'TRSF E-BANKING DB - PEMBELIAN BAHAN BAKU', 'TRF-0004', 980000, 0],
    [20, 'BIAYA ADMINISTRASI', '', 15000, 0],
    [27, 'BUNGA', '', 0, 12500],
    [27, 'PAJAK BUNGA', '', 2500, 0],
  ]
  let saldo = round2(opening)
  const rows: (string | number)[][] = [[exampleDate(start, end, 0), 'SALDO AWAL', '', '', '', saldo]]
  for (const [days, desc, ref, out, inn] of sample) {
    saldo = round2(saldo - out + inn)
    rows.push([exampleDate(start, end, days), desc, ref, out || '', inn || '', saldo])
  }
  return rows
}

interface PreviewRow {
  row: number
  line: StatementLineInput | null
  raw: { date: string; description: string; out: string; in: string }
  errors: string[]
}

export default function StatementUpload({
  rec,
  editBlock,
  canUpdate,
}: {
  rec: BankReconciliation
  editBlock: string | null
  canUpdate: boolean
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ fileName: string; rows: PreviewRow[]; skipped: number } | null>(null)

  const start = toInputDate(rec.statement_start_date)
  const end = toInputDate(rec.statement_end_date)
  const lines = rec.statement_lines ?? []
  const matchedCount = lines.filter((l) => l.match_group_id != null).length
  const unmatchedCount = lines.length - matchedCount

  // Builds the statement workbook: the empty template, or the same layout
  // filled with sample lines (the Example) dated inside this statement period,
  // so it can be uploaded as-is to see how an import looks.
  const downloadWorkbook = (example: boolean) => {
    const rows: (string | number)[][] = [HEADERS]
    if (example) rows.push(...exampleRows(start, end, num(rec.statement_opening_balance)))
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 44 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 18 }]
    const guide = XLSX.utils.aoa_to_sheet([
      [example ? 'Contoh rekening koran (bank statement) — berisi data contoh' : 'Template rekening koran (bank statement)'],
      [],
      ...(example
        ? [['Data di sheet "Rekening Koran" hanya contoh. Ganti dengan mutasi dari rekening koran Anda sebelum diunggah, atau gunakan file Template yang kosong.'], []]
        : []),
      [`1. Isi satu baris per mutasi pada periode ${formatDate(rec.statement_start_date)} – ${formatDate(rec.statement_end_date)}.`],
      ['2. Tanggal: dd/mm/yyyy (mis. 05/03/2026), yyyy-mm-dd, atau format tanggal Excel.'],
      ['3. Gunakan sudut pandang BANK seperti di rekening koran: Debet = uang KELUAR dari rekening, Kredit = uang MASUK.'],
      ['4. Isi Debet ATAU Kredit pada satu baris — jangan keduanya. Baris tanpa nominal (mis. saldo awal) dilewati.'],
      ['5. Angka boleh ditulis 1500000, 1.500.000 atau 1,500,000.00. Saldo dan Referensi boleh dikosongkan.'],
      ['6. Header kolom dari ekspor bank (Tanggal/Date/Tgl, Keterangan/Uraian, Mutasi Debet, Mutasi Kredit, Saldo) juga dikenali.'],
      ['7. Upload ulang mengganti semua baris yang BELUM dicocokkan; baris yang sudah dicocokkan tetap disimpan.'],
    ])
    guide['!cols'] = [{ wch: 110 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_SHEET)
    XLSX.utils.book_append_sheet(wb, guide, 'Petunjuk')
    const bank = (rec.bank_account?.bank_name ?? 'bank').replace(/[^\w-]+/g, '-')
    XLSX.writeFile(wb, `rekening-koran-${example ? 'contoh' : 'template'}_${bank}_${start || 'periode'}.xlsx`)
  }

  const parseFile = async (file: File) => {
    try {
      // raw: keep CSV text as typed, so 05/03/2026 isn't read as May 3rd.
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: /\.csv$/i.test(file.name) })
      const ws = wb.Sheets[TEMPLATE_SHEET] ?? wb.Sheets[wb.SheetNames[0]]
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
      const headerIdx = findHeaderRow(grid, DATE_ALIASES)
      if (headerIdx < 0) {
        toast.error('No "Tanggal" column found — use the downloaded template')
        return
      }
      const col = columnFinder(grid[headerIdx], { prefix: true })
      const dateCol = col(...DATE_ALIASES)
      const descCol = col(...DESC_ALIASES)
      const refCol = col(...REF_ALIASES)
      const outCol = col(...OUT_ALIASES)
      const inCol = col(...IN_ALIASES)
      const balCol = col(...BAL_ALIASES)
      if (outCol < 0 || inCol < 0) {
        toast.error('The file needs Debet and Kredit columns')
        return
      }

      const rows: PreviewRow[] = []
      let skipped = 0
      grid.slice(headerIdx + 1).forEach((r, i) => {
        const rowNo = headerIdx + i + 2
        const cell = (c: number) => (c < 0 ? '' : r[c])
        const rawDate = cell(dateCol)
        const desc = String(cell(descCol) ?? '').trim()
        const ref = String(cell(refCol) ?? '').trim()
        const outRaw = cell(outCol)
        const inRaw = cell(inCol)
        if (r.every(isBlankCell)) return
        const out = parseAmount(outRaw)
        const inn = parseAmount(inRaw)
        // Rows with no movement at all (saldo awal / akhir, totals) are skipped.
        if (out === 0 && inn === 0) {
          skipped++
          return
        }
        const errors: string[] = []
        const date = parseDateCell(rawDate)
        if (!date) errors.push(isBlankCell(rawDate) ? 'Date is empty' : `Date "${String(rawDate)}" not recognised`)
        else if ((start && date < start) || (end && date > end))
          errors.push(`Date ${formatDate(date)} is outside the statement period`)
        if (out === null) errors.push('Debet is not a number')
        if (inn === null) errors.push('Kredit is not a number')
        if ((out ?? 0) < 0 || (inn ?? 0) < 0) errors.push('Amounts cannot be negative')
        if ((out ?? 0) > 0 && (inn ?? 0) > 0) errors.push('Fill Debet or Kredit, not both')
        if (!desc) errors.push('Keterangan is empty')
        let balance: number | null = null
        if (balCol > -1 && !isBlankCell(cell(balCol))) {
          balance = parseAmount(cell(balCol))
          if (balance === null) errors.push('Saldo is not a number')
        }
        rows.push({
          row: rowNo,
          raw: { date: String(rawDate ?? ''), description: desc, out: String(outRaw ?? ''), in: String(inRaw ?? '') },
          errors,
          line: errors.length
            ? null
            : {
                date: date!,
                description: desc,
                reference: ref || undefined,
                amount_in: round2(inn ?? 0),
                amount_out: round2(out ?? 0),
                balance: balance === null ? null : round2(balance),
              },
        })
      })
      if (!rows.length) {
        toast.error('No statement lines with an amount were found in the file')
        return
      }
      setPreview({ fileName: file.name, rows, skipped })
    } catch {
      toast.error('Could not read the file — save it as .xlsx and try again')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: (payload: StatementLineInput[]) => bankReconciliationsService.replaceStatementLines(rec.id, payload),
    onSuccess: (_res, payload) => {
      qc.invalidateQueries({ queryKey: ['bank-reconciliation', rec.id] })
      qc.invalidateQueries({ queryKey: ['bank-reconciliations'] })
      toast.success(`${payload.length} statement line(s) saved`)
      setPreview(null)
    },
    onError: (err) => toastMutationApiError(err, 'Failed to save the statement lines'),
  })

  const okRows = preview?.rows.filter((r) => r.line) ?? []
  const errRows = preview?.rows.filter((r) => !r.line) ?? []
  const totalIn = round2(okRows.reduce((s, r) => s + (r.line?.amount_in ?? 0), 0))
  const totalOut = round2(okRows.reduce((s, r) => s + (r.line?.amount_out ?? 0), 0))
  // Matched lines stay on the server, so they count toward the movement too.
  const keptIn = lines.filter((l) => l.match_group_id != null).reduce((s, l) => s + num(l.amount_in), 0)
  const keptOut = lines.filter((l) => l.match_group_id != null).reduce((s, l) => s + num(l.amount_out), 0)
  const expectedClosing = round2(num(rec.statement_opening_balance) + totalIn + keptIn - totalOut - keptOut)
  const movementOk = expectedClosing === round2(num(rec.statement_closing_balance))

  const uploadDisabled = !!editBlock || !canUpdate

  return (
    <div className="v2-card" style={{ ...cardStyle, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <FileSpreadsheet size={18} color="var(--accent-light)" />
      <div style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>Bank statement (rekening koran)</div>
        <div style={{ color: 'var(--foreground-muted)', fontSize: 12 }}>
          {lines.length
            ? `${lines.length} line(s) · ${matchedCount} matched · ${unmatchedCount} unmatched. Re-uploading replaces the unmatched lines only.`
            : 'No lines yet — download the template (or use the bank’s Excel/CSV export) and upload it.'}
        </div>
      </div>
      <button type="button" className="v2-btn v2-btn-ghost" onClick={() => downloadWorkbook(false)} title="Empty template to fill in">
        <Download size={14} /> Template
      </button>
      <button type="button" className="v2-btn v2-btn-ghost" onClick={() => downloadWorkbook(true)} title="Filled example file">
        <Download size={14} /> Example
      </button>
      {canUpdate && (
        <button
          type="button"
          className="v2-btn v2-btn-primary"
          disabled={uploadDisabled}
          title={editBlock ?? undefined}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={14} /> Upload statement
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) parseFile(f)
        }}
      />

      {preview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v2-overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} onClick={() => setPreview(null)} />
          <div
            className="v2-dialog"
            style={{
              position: 'relative', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: 920,
              maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Preview — {preview.fileName}</div>
              <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                {okRows.length} valid · {errRows.length} with errors
                {preview.skipped ? ` · ${preview.skipped} row(s) without an amount skipped` : ''}
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table className="v2-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>Row</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Money in (Kredit)</th>
                    <th style={{ textAlign: 'right' }}>Money out (Debet)</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <React.Fragment key={r.row}>
                      <tr style={r.errors.length ? { background: 'var(--destructive-bg)' } : undefined}>
                        <td style={{ color: 'var(--foreground-muted)' }}>{r.row}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{r.line ? formatDate(r.line.date) : r.raw.date || '—'}</td>
                        <td>
                          {r.line?.description ?? r.raw.description}
                          {r.line?.reference && (
                            <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}> · {r.line.reference}</span>
                          )}
                        </td>
                        <td style={numCell}>{r.line ? (r.line.amount_in ? money(r.line.amount_in) : '') : r.raw.in}</td>
                        <td style={numCell}>{r.line ? (r.line.amount_out ? money(r.line.amount_out) : '') : r.raw.out}</td>
                        <td style={{ ...numCell, color: 'var(--foreground-muted)' }}>
                          {r.line?.balance != null ? money(r.line.balance) : ''}
                        </td>
                      </tr>
                      {r.errors.length > 0 && (
                        <tr style={{ background: 'var(--destructive-bg)' }}>
                          <td />
                          <td colSpan={5} style={{ color: 'var(--destructive)', fontSize: 12, height: 28 }}>
                            {r.errors.join(' · ')}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12.5, color: 'var(--foreground-muted)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>In <strong style={{ color: 'var(--foreground)' }}>{money(totalIn)}</strong></span>
                <span>Out <strong style={{ color: 'var(--foreground)' }}>{money(totalOut)}</strong></span>
                <span>
                  Opening {money(rec.statement_opening_balance)} + movement ={' '}
                  <strong style={{ color: movementOk ? 'var(--success)' : 'var(--warning)' }}>{money(expectedClosing)}</strong>
                  {movementOk
                    ? ' = statement closing ✓'
                    : ` ≠ statement closing ${money(rec.statement_closing_balance)} — check for missing rows`}
                </span>
                {matchedCount > 0 && <span>{matchedCount} matched line(s) are kept as they are.</span>}
              </div>
              {errRows.length > 0 && (
                <div style={{ fontSize: 12.5, color: 'var(--destructive)' }}>
                  Fix the {errRows.length} row(s) in red in the file and upload again.
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="v2-btn v2-btn-ghost" onClick={() => setPreview(null)}>Cancel</button>
                <button
                  type="button"
                  className="v2-btn v2-btn-primary"
                  disabled={isPending || errRows.length > 0 || okRows.length === 0}
                  onClick={() => save(okRows.map((r) => r.line!))}
                >
                  {isPending ? 'Saving…' : `Replace ${unmatchedCount} unmatched with ${okRows.length} line(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
