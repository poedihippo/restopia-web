'use client'

/**
 * Shared A4 print / "Save as PDF" layout for business documents
 * (Delivery Note, Purchase Order, Invoice, Sales Order invoice).
 *
 * - Ink-friendly: white paper, black text, thin rules, no fills.
 * - Every printed page is one complete sheet: company kop, title, document
 *   info, "Sheet X / Y", column headings and (optional) signatures. Sheets are
 *   sized by measuring the real row heights in an off-screen copy, so long /
 *   wrapping rows never spill a sheet onto a second page (browsers don't
 *   reliably repeat a tall <thead> across pages).
 * - @page margin is 0 so the browser prints no URL / date / page-number
 *   header & footer; the 18mm margin lives inside each sheet instead.
 * - While printing, document.title is swapped so "Save as PDF" suggests a
 *   useful file name.
 */
import React, { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { branchesService } from '@/services/branches.service'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "01 JAN 2026". Accepts YYYY-MM-DD[...] (ISO) and DD-MM-YYYY; date part only (no TZ shift). */
export function formatPrintDate(value?: string | null): string {
  if (!value) return '-'
  const v = String(value)
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  const dmy = /^(\d{2})-(\d{2})-(\d{4})/.exec(v)
  const d = iso
    ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    : dmy
      ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
      : new Date(v)
  if (isNaN(d.getTime())) return v
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** Join non-empty parts into a file-name-safe title: "Purchase Order 0018-WK-11-2026 - Supplier - 17 NOV 2026". */
export function printFileTitle(...parts: Array<string | null | undefined | false>): string {
  return parts
    .filter((p): p is string => !!p && String(p).trim() !== '' && p !== '-')
    .map((p) => String(p).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim())
    .join(' - ')
}

/** Company (name + address) of a branch, for the kop. Falls back to the branch itself. */
export function usePrintCompany(branchId?: number | null, fallbackName?: string) {
  const id = Number(branchId) || 0
  const { data } = useQuery({
    queryKey: ['branch-detail', id, 'company'],
    queryFn: () => branchesService.findById(id, { include: 'company' }).then((r) => r.data),
    enabled: id > 0,
  })
  const branch = (data as any)?.data as
    | { name?: string; address?: string | null; company?: { name?: string; address?: string | null } }
    | undefined
  return {
    name: branch?.company?.name || branch?.name || fallbackName || '',
    address: branch?.company?.address || branch?.address || '',
  }
}

export type PrintColumn = {
  header: string
  /** Fixed width, e.g. '20mm'. Leave one column without width to take the rest. */
  width?: string
  align?: 'left' | 'center' | 'right'
  nowrap?: boolean
  /** Break long unspaced values (batch codes). */
  breakAnywhere?: boolean
}

export type PrintRow = { key: React.Key; cells: ReactNode[] }

export type PrintMetaItem = { label: string; value: ReactNode }

export type PrintTotalsLine = { label: ReactNode; value: ReactNode; strong?: boolean; ruleAbove?: boolean }

/** Right-aligned totals box (ink-friendly), for use as `afterTable`. */
export function PrintTotals({ lines }: { lines: PrintTotalsLine[] }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <table className="pd-table" style={{ width: '45%', borderCollapse: 'collapse' }}>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td
                className="pd-tot"
                style={{
                  padding: '1mm 0',
                  fontWeight: l.strong ? 700 : 400,
                  borderTop: l.ruleAbove ? '1px solid #000' : undefined,
                }}
              >
                {l.label}
              </td>
              <td
                className="pd-tot"
                style={{
                  padding: '1mm 0',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  fontWeight: l.strong ? 700 : 400,
                  borderTop: l.ruleAbove ? '1px solid #000' : undefined,
                }}
              >
                {l.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type PrintDocumentProps = {
  /** Document title, e.g. "DELIVERY NOTE". */
  title: string
  company: { name?: string; address?: string | null }
  /** Document info, laid out in two columns (row-major). */
  meta: PrintMetaItem[]
  columns: PrintColumn[]
  rows: PrintRow[]
  /** Printed under the table on the LAST sheet only (notes, totals). */
  afterTable?: ReactNode
  /** Signature boxes pinned to the bottom of EVERY sheet, e.g. ['Sender', 'Receiver']. */
  signatures?: string[]
  /** Suggested "Save as PDF" file name. */
  fileTitle?: string
}

const MM = 96 / 25.4
// Sheet: 296mm tall with 18mm padding top/bottom = 260mm of content.
const SHEET_CONTENT_MM = 260
const SAFETY_MM = 1.5

const cellBorder = '1px solid #000'

export default function PrintDocument({
  title,
  company,
  meta,
  columns,
  rows,
  afterTable,
  signatures,
  fileTitle,
}: PrintDocumentProps) {
  const measureRef = useRef<HTMLDivElement>(null)
  const [sizes, setSizes] = useState<number[] | null>(null)

  // Re-measure after every render (cheap); only commit when the split changes.
  useEffect(() => {
    const measure = () => {
      const el = measureRef.current
      if (!el) return
      const h = (q: string) => el.querySelector(q)?.getBoundingClientRect().height ?? 0
      const avail = (SHEET_CONTENT_MM - SAFETY_MM) * MM - h('.pd-head') - h('.pd-sign')
      const afterH = h('.pd-after')
      const rowHs = Array.from(el.querySelectorAll('tr.pd-row')).map((r) => r.getBoundingClientRect().height)
      const next: number[] = []
      let used = 0
      let count = 0
      rowHs.forEach((rh) => {
        if (count > 0 && used + rh > avail) {
          next.push(count)
          used = 0
          count = 0
        }
        used += rh
        count++
      })
      // Notes / totals go under the last row; give them room on the last sheet.
      if (afterH > 0 && used + afterH > avail) {
        if (count > 1) {
          next.push(count - 1)
          count = 1
        } else if (count === 1 && rowHs.length > 0) {
          next.push(1)
          count = 0
        }
      }
      next.push(count)
      setSizes((prev) => (prev && prev.join(',') === next.join(',') ? prev : next))
    }
    measure()
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {})
    }
  })

  // Descriptive document.title while printing → useful PDF file name.
  useEffect(() => {
    if (!fileTitle) return
    let prev: string | null = null
    const before = () => {
      prev = document.title
      document.title = fileTitle
    }
    const after = () => {
      if (prev !== null) document.title = prev
      prev = null
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
      after()
    }
  }, [fileTitle])

  const sheets: { rows: PrintRow[]; start: number }[] = []
  if (sizes && sizes.reduce((a, b) => a + b, 0) === rows.length) {
    let start = 0
    sizes.forEach((n) => {
      sheets.push({ rows: rows.slice(start, start + n), start })
      start += n
    })
  } else {
    // Not measured yet: conservative fallback.
    for (let i = 0; i < rows.length; i += 8) sheets.push({ rows: rows.slice(i, i + 8), start: i })
  }
  if (sheets.length === 0) sheets.push({ rows: [], start: 0 })

  const metaPairs: PrintMetaItem[][] = []
  for (let i = 0; i < meta.length; i += 2) metaPairs.push(meta.slice(i, i + 2))

  const renderSheet = (sheetRows: PrintRow[], sheetIndex: number, sheetCount: number, isLast: boolean) => (
    <>
      <div className="pd-head">
        {/* Kop: company identity, ruled off */}
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '3mm' }}>
          <div style={{ fontSize: '12pt', fontWeight: 700 }}>{company.name || '-'}</div>
          {company.address ? (
            <div style={{ fontSize: '8.5pt', marginTop: '1mm', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{String(company.address).trim()}</div>
          ) : null}
        </div>
        {/* Document title */}
        <div style={{ textAlign: 'center', fontSize: '13pt', fontWeight: 700, letterSpacing: '1px', margin: '4mm 0' }}>
          {title}
        </div>
        {/* Document info — two columns */}
        <table className="pd-table" style={{ width: '100%', fontSize: '10pt', borderCollapse: 'collapse', marginBottom: '2mm' }}>
          <tbody>
            {metaPairs.map((pair, i) => (
              <tr key={i}>
                {[0, 1].map((j) => (
                  <td key={j} className="pd-meta" style={{ width: '50%', verticalAlign: 'top', padding: '0.5mm 0' }}>
                    {pair[j] ? (
                      <>
                        <strong>{pair[j].label}:</strong> {pair[j].value}
                      </>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', fontSize: '9pt', paddingBottom: '1mm' }}>
          Sheet {sheetIndex + 1} / {sheetCount}
        </div>
      </div>

      <table
        className="pd-table"
        style={{ width: '100%', fontSize: '10pt', borderCollapse: 'collapse', tableLayout: 'fixed' }}
      >
        <colgroup>
          {columns.map((c, i) => (
            <col key={i} style={c.width ? { width: c.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={i}
                className="pd-grid"
                style={{ border: cellBorder, padding: '1.5mm 2mm', textAlign: c.align ?? 'left' }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheetRows.map((r) => (
            <tr key={r.key} className="pd-row">
              {r.cells.map((cell, i) => {
                const c = columns[i] ?? ({} as PrintColumn)
                return (
                  <td
                    key={i}
                    className="pd-grid"
                    style={{
                      border: cellBorder,
                      padding: '1.5mm 2mm',
                      textAlign: c.align ?? 'left',
                      whiteSpace: c.nowrap ? 'nowrap' : undefined,
                      overflowWrap: c.breakAnywhere ? 'anywhere' : undefined,
                    }}
                  >
                    {cell}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {isLast && afterTable ? (
        <div className="pd-after" style={{ paddingTop: '3mm', fontSize: '10pt' }}>
          {afterTable}
        </div>
      ) : null}

      {signatures && signatures.length > 0 ? (
        <div className="pd-sign" style={{ paddingTop: '3mm' }}>
          <table className="pd-table" style={{ width: '100%', fontSize: '10pt', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                {signatures.map((label) => (
                  <td
                    key={label}
                    style={{ width: `${100 / signatures.length}%`, textAlign: 'center', verticalAlign: 'top', padding: '0 4mm' }}
                  >
                    <div>{label}</div>
                    {/* Signing space: padding (not height) so print's height:auto can't collapse it */}
                    <div style={{ paddingTop: '15mm' }}>( ____________ )</div>
                    <div style={{ fontSize: '8pt', marginTop: '1mm' }}>Full Name</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )

  return (
    <>
      {/* Printable sheets (hidden on screen) */}
      <div className="pd-print">
        {sheets.map((s, i) => (
          <div
            key={i}
            className="pd-page"
            style={i < sheets.length - 1 ? { breakAfter: 'page', pageBreakAfter: 'always' } : undefined}
          >
            {renderSheet(s.rows, i, sheets.length, i === sheets.length - 1)}
          </div>
        ))}
      </div>

      {/* Off-screen copy used only to measure real heights for sheet paging */}
      <div
        ref={measureRef}
        className="pd-measure"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -10000,
          top: 0,
          width: '174mm',
          visibility: 'hidden',
          pointerEvents: 'none',
          color: '#000',
          background: '#fff',
          fontFamily: 'Arial, Helvetica, sans-serif',
          lineHeight: 1.35,
        }}
      >
        {renderSheet(rows, 0, 1, true)}
      </div>

      <style>{`
        .pd-print { display: none; }
        /* Mirror the print-time box rules so measured heights equal printed ones. */
        .pd-measure * { height: auto !important; min-height: 0 !important; max-height: none !important; }
        /* Opt out of the app-wide v2 table look (ui-v2.css forces cell padding,
           11px / weight-500 headers with !important). Repeated .pd-table only
           raises specificity above those rules. */
        :is(.pd-print, .pd-measure) .pd-table.pd-table.pd-table :is(th, td) {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          font-size: inherit !important;
          font-weight: inherit !important;
          color: #000 !important;
          background: transparent !important;
        }
        :is(.pd-print, .pd-measure) .pd-table.pd-table.pd-table .pd-grid {
          padding-top: 1.5mm !important;
          padding-bottom: 1.5mm !important;
        }
        :is(.pd-print, .pd-measure) .pd-table.pd-table.pd-table th.pd-grid {
          font-weight: 700 !important;
          white-space: normal !important;
          border-bottom: 1px solid #000 !important;
        }
        :is(.pd-print, .pd-measure) .pd-table.pd-table.pd-table .pd-meta {
          padding-top: 0.5mm !important;
          padding-bottom: 0.5mm !important;
        }
        :is(.pd-print, .pd-measure) .pd-table.pd-table.pd-table .pd-tot {
          padding-top: 1mm !important;
          padding-bottom: 1mm !important;
        }
        @media print {
          /* margin 0 = no browser URL/date/page-number header & footer. */
          @page { size: A4 portrait; margin: 0; }
          /* Defeat the global pos-print.css rule (body > * { display:none }). */
          body > * { display: block !important; }
          #pos-receipt { display: none !important; }
          /* Remove every on-screen element that doesn't contain the document,
             so nothing else takes up space (no stray blank pages). */
          body *:not(:has(.pd-print)):not(.pd-print):not(.pd-print *) { display: none !important; }
          body *:has(.pd-print) {
            display: block !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            overflow: visible !important;
            transform: none !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          .pd-print {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            color: #000;
            background: #fff;
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.35;
          }
          .pd-measure { display: none !important; }
          /* Each sheet fills exactly one A4 page; signatures sit at its bottom. */
          .pd-print .pd-page {
            display: flex !important;
            flex-direction: column;
            height: 296mm !important;
            box-sizing: border-box;
            padding: 18mm !important;
            overflow: hidden;
          }
          .pd-print .pd-page > .pd-sign { margin-top: auto; }
          .pd-print .pd-row { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </>
  )
}
