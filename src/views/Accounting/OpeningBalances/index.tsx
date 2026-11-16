'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Download, FileSpreadsheet, Trash2, Upload } from 'lucide-react'
import { chartOfAccountsService, journalsService, periodsService } from '@/services/accounting.service'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, toInputDate } from '@/utils/date'
import { toastMutationApiError } from '@/utils/apiError'
import SearchableSelect from '@/components/SearchableSelect'
import LocalizedNumberInput from '@/components/LocalizedNumberInput'
import { columnFinder, findHeaderRow, parseAmount } from '@/utils/excelImport'

/**
 * Opening balances (saldo awal) of the chart of accounts.
 *
 * The backend has no per-account opening balance field — balances come only from
 * posted journals — so the opening balance is ONE journal for the active branch:
 * type `adjustment`, reference_type `opening_balance`, description OPENING_DESC.
 * Any debit/credit difference is booked to the chosen balancing (equity) account.
 *
 * Modify: a draft journal is updated in place (its lines are replaced); a posted
 * one is reversed and a new draft is created, because posted journals are locked.
 */

const REFERENCE_TYPE = 'opening_balance'
const OPENING_DESC = 'Saldo Awal / Opening Balance'
const TEMPLATE_SHEET = 'Saldo Awal'

interface Account {
  id: number
  code: string
  name: string
  is_header: boolean
  is_active?: boolean
  normal_balance: 'debit' | 'credit'
}

interface Period {
  id: number
  name: string
  start_date?: string
  end_date?: string
  is_closed?: boolean
}

interface OpeningJournal {
  id: number
  journal_number: string
  date: string
  description: string
  reference_type?: string | null
  is_posted: boolean
  is_reversed: boolean
  journal_details?: { chart_of_account_id: number; debit: number | string; credit: number | string; description?: string | null }[]
}

interface Line {
  accountId: number
  debit: number
  credit: number
}

interface ImportIssue {
  row: number
  message: string
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--foreground)',
  background: 'var(--surface-raised)', outline: 'none', fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}
const thStyle: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600,
  color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = { padding: '8px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', fontSize: 13 }
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)' }
const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
  border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)',
  color: 'var(--foreground)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
}
const primaryBtnStyle: React.CSSProperties = { ...btnStyle, background: 'var(--accent)', color: 'white', border: '1px solid var(--accent)' }

const fmtNumber = (n: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
const round2 = (n: number) => Math.round(n * 100) / 100

async function fetchAllAccounts(): Promise<Account[]> {
  const all: Account[] = []
  for (let page = 1; page <= 50; page++) {
    const body: any = await chartOfAccountsService
      .list({ page, per_page: 1000, sort: 'code' } as any)
      .then((r) => r.data)
    const rows: Account[] = Array.isArray(body?.data) ? body.data : body?.data?.data ?? []
    all.push(...rows)
    const meta = Array.isArray(body?.data) ? body?.meta : body?.data?.meta ?? body?.meta
    const totalPages = Number(meta?.total_pages ?? meta?.last_page ?? 1)
    if (page >= totalPages || rows.length === 0) break
  }
  return all
}

export default function OpeningBalancesView() {
  const { isSuperadmin, hasPermission, user } = useAuth()
  const canRead = isSuperadmin || hasPermission('journal.read') || hasPermission('journal.menu')
  const canCreate = isSuperadmin || hasPermission('journal.create')
  const canUpdate = isSuperadmin || hasPermission('journal.update')
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState('')
  const [balancingId, setBalancingId] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [issues, setIssues] = useState<ImportIssue[]>([])
  const [dirty, setDirty] = useState(false)
  const [addAccountId, setAddAccountId] = useState(0)
  const [confirmPost, setConfirmPost] = useState(false)

  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['chart-of-accounts-all', 'opening-balances'],
    enabled: canRead,
    staleTime: 5 * 60_000,
    queryFn: fetchAllAccounts,
  })
  const accountById = useMemo(() => new Map(accounts.map((a) => [Number(a.id), a])), [accounts])
  const postable = useMemo(() => accounts.filter((a) => !a.is_header && a.is_active !== false), [accounts])

  const { data: periodsData } = useQuery({
    queryKey: ['periods-all', 'opening-balances'],
    enabled: canRead,
    queryFn: () => periodsService.list({ per_page: 1000, sort: 'start_date' } as any).then((r) => r.data),
  })
  const periods = useMemo<Period[]>(() => (periodsData as any)?.data ?? [], [periodsData])

  const { data: existing, isLoading: existingLoading } = useQuery({
    queryKey: ['journals', 'opening-balance', user?.branch_id],
    enabled: canRead,
    queryFn: async () => {
      const body: any = await journalsService
        .list({ per_page: 100, sort: '-id', include: 'journal_details', 'filter[type]': 'adjustment', 'filter[search]': OPENING_DESC } as any)
        .then((r) => r.data)
      const rows: OpeningJournal[] = body?.data ?? []
      return rows.find((j) => j.reference_type === REFERENCE_TYPE && j.description === OPENING_DESC && !j.is_reversed) ?? null
    },
  })

  // Load the saved journal into the editor (balancing line split back out).
  useEffect(() => {
    if (existing === undefined || dirty) return
    if (!existing) {
      setLines([])
      return
    }
    setDate(toInputDate(existing.date))
    const details = existing.journal_details ?? []
    const balancing = details.find((d) => (d.description ?? '') === 'Balancing')
    if (balancing) setBalancingId(Number(balancing.chart_of_account_id))
    setLines(
      details
        .filter((d) => d !== balancing)
        .map((d) => ({ accountId: Number(d.chart_of_account_id), debit: Number(d.debit) || 0, credit: Number(d.credit) || 0 })),
    )
  }, [existing, dirty])

  // Default balancing account: the chart's "Historical Balancing" equity account
  // (seeded for every company for exactly this), else one named for opening balances.
  useEffect(() => {
    if (balancingId || !postable.length) return
    const match =
      postable.find((a) => /historical balancing/i.test(a.name)) ??
      postable.find((a) => /saldo awal|opening balance/i.test(a.name))
    if (match) setBalancingId(Number(match.id))
  }, [postable, balancingId])

  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0))
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0))
  const difference = round2(totalDebit - totalCredit)
  const period = useMemo(() => {
    if (!date) return undefined
    return periods.find((p) => p.start_date && p.end_date && toInputDate(p.start_date) <= date && date <= toInputDate(p.end_date))
  }, [date, periods])

  const isPosted = !!existing?.is_posted
  const canSave = existing ? canUpdate || (isPosted && canCreate) : canCreate

  const blocking: string | null = (() => {
    if (!date) return 'Pick the opening balance date'
    if (!period) return 'No accounting period covers this date — create it under Accounting → Master Data → Periods'
    if (period.is_closed) return `Period ${period.name} is closed`
    if (lines.length === 0) return 'Add at least one account balance'
    if (difference !== 0 && !balancingId) return 'Pick a balancing account for the difference'
    if (issues.length > 0) return 'Fix the import errors first'
    return null
  })()

  // ── Template ────────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    if (!postable.length) {
      toast.error('Chart of accounts is still loading')
      return
    }
    const byId = new Map(lines.map((l) => [l.accountId, l]))
    const header = ['Code', 'Account', 'Normal Balance', 'Debit', 'Credit']
    const body = postable.map((a) => {
      const l = byId.get(Number(a.id))
      return [a.code, a.name, a.normal_balance === 'credit' ? 'Credit' : 'Debit', l?.debit || '', l?.credit || '']
    })
    const ws = XLSX.utils.aoa_to_sheet([header, ...body])
    ws['!cols'] = [{ wch: 14 }, { wch: 42 }, { wch: 15 }, { wch: 18 }, { wch: 18 }]
    const guide = XLSX.utils.aoa_to_sheet([
      ['Opening balance template (Saldo Awal)'],
      [],
      ['1. Fill the balance of each account in Debit OR Credit — never both. Leave accounts without a balance empty.'],
      ['2. Use the Normal Balance column as a guide: assets/expenses are usually Debit, liabilities/equity/revenue Credit.'],
      ['3. Do not change the Code column. Rows can be deleted; header accounts are not listed (they roll up automatically).'],
      ['4. Numbers can be typed as 1500000, 1.500.000 or 1,500,000.00.'],
      ['5. If total Debit ≠ total Credit, the difference is booked to the balancing account chosen in the app (default: Historical Balancing).'],
      ['6. To change the balances later, download this template again from the app (it comes pre-filled), edit, and re-import.'],
    ])
    guide['!cols'] = [{ wch: 110 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_SHEET)
    XLSX.utils.book_append_sheet(wb, guide, 'Petunjuk')
    XLSX.writeFile(wb, `opening-balance-template${date ? `_${date}` : ''}.xlsx`)
  }

  // ── Import ──────────────────────────────────────────────────────────────
  const importFile = async (file: File) => {
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const ws = wb.Sheets[TEMPLATE_SHEET] ?? wb.Sheets[wb.SheetNames[0]]
      const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' })
      const headerIdx = findHeaderRow(grid, ['code', 'kode'])
      if (headerIdx < 0) {
        toast.error('No "Code" column found — use the downloaded template')
        return
      }
      const col = columnFinder(grid[headerIdx])
      const codeCol = col('code', 'kode')
      const debitCol = col('debit', 'debet')
      const creditCol = col('credit', 'kredit')
      if (debitCol < 0 || creditCol < 0) {
        toast.error('The file needs Debit and Credit columns')
        return
      }
      const byCode = new Map(accounts.map((a) => [String(a.code).trim(), a]))
      const seen = new Map<number, number>()
      const nextLines: Line[] = []
      const nextIssues: ImportIssue[] = []
      grid.slice(headerIdx + 1).forEach((r, i) => {
        const rowNo = headerIdx + i + 2
        const code = String(r[codeCol] ?? '').trim()
        const debit = parseAmount(r[debitCol])
        const credit = parseAmount(r[creditCol])
        if (!code && !debit && !credit) return
        if (debit === null || credit === null) return nextIssues.push({ row: rowNo, message: `${code || 'Row'}: amount is not a number` })
        if (!debit && !credit) return
        const account = byCode.get(code)
        if (!account) return nextIssues.push({ row: rowNo, message: `Account code "${code}" not found` })
        if (account.is_header) return nextIssues.push({ row: rowNo, message: `${code} is a header account — put the balance on its sub-accounts` })
        if (account.is_active === false) return nextIssues.push({ row: rowNo, message: `${code} is inactive` })
        if (debit < 0 || credit < 0) return nextIssues.push({ row: rowNo, message: `${code}: amounts cannot be negative — use the other column` })
        if (debit > 0 && credit > 0) return nextIssues.push({ row: rowNo, message: `${code}: fill Debit or Credit, not both` })
        const dup = seen.get(Number(account.id))
        if (dup) return nextIssues.push({ row: rowNo, message: `${code} appears twice (rows ${dup} and ${rowNo})` })
        seen.set(Number(account.id), rowNo)
        nextLines.push({ accountId: Number(account.id), debit: round2(debit), credit: round2(credit) })
      })
      setLines(nextLines)
      setIssues(nextIssues)
      setDirty(true)
      if (nextIssues.length) toast.error(`${nextIssues.length} row(s) need fixing — see the list below`)
      else toast.success(`${nextLines.length} account balance(s) imported — review and save`)
    } catch {
      toast.error('Could not read the file — save it as .xlsx and try again')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── Save / post ─────────────────────────────────────────────────────────
  const buildDetails = () => {
    const details = lines
      .filter((l) => l.debit > 0 || l.credit > 0)
      .map((l) => ({ chart_of_account_id: l.accountId, debit: l.debit, credit: l.credit, description: OPENING_DESC }))
    if (difference !== 0) {
      details.push({
        chart_of_account_id: balancingId,
        debit: difference < 0 ? -difference : 0,
        credit: difference > 0 ? difference : 0,
        description: 'Balancing',
      })
    }
    return details
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: async () => {
      const payload = {
        period_id: period!.id,
        date,
        type: 'adjustment' as const,
        description: OPENING_DESC,
        reference_type: REFERENCE_TYPE,
        details: buildDetails(),
      }
      if (existing && !existing.is_posted) return journalsService.update(existing.id, payload as any)
      if (!existing?.is_posted) return journalsService.create(payload as any)
      // Posted journals are locked: save the new draft FIRST, then reverse the old
      // one. If the reversal fails, drop the new draft so the posted opening
      // balance is never left reversed without a replacement (or doubled).
      const created = await journalsService.create(payload as any)
      try {
        await journalsService.reverse(existing.id)
      } catch (err) {
        const newId = (created as any)?.data?.data?.id
        if (newId) await journalsService.delete(newId).catch(() => undefined)
        throw err
      }
      return created
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journals'] })
      setDirty(false)
      setIssues([])
      toast.success(existing?.is_posted ? 'Old opening balance reversed — new draft saved' : 'Opening balance saved as draft')
    },
    onError: (err) => toastMutationApiError(err, 'Failed to save opening balance'),
  })

  const { mutate: post, isPending: posting } = useMutation({
    mutationFn: () => journalsService.post(existing!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journals'] })
      setConfirmPost(false)
      toast.success('Opening balance posted')
    },
    onError: (err) => toastMutationApiError(err, 'Failed to post opening balance'),
  })

  const updateLine = (idx: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
    setDirty(true)
  }

  const accountOptions = postable.map((a) => ({ value: Number(a.id), label: a.name, sublabel: a.code }))
  const addOptions = accountOptions.filter((o) => !lines.some((l) => l.accountId === o.value))
  const sortedLines = lines
    .map((l, idx) => ({ ...l, idx, code: accountById.get(l.accountId)?.code ?? '' }))
    .sort((a, b) => a.code.localeCompare(b.code))

  if (!canRead) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>
            Opening Balances
          </h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
            Starting balance of each account (saldo awal) for this branch, booked as one opening journal
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={btnStyle} onClick={downloadTemplate} disabled={accountsLoading}>
            <Download size={14} /> {lines.length ? 'Download (pre-filled)' : 'Download Template'}
          </button>
          {canSave && (
            <button type="button" style={btnStyle} onClick={() => fileRef.current?.click()} disabled={accountsLoading}>
              <Upload size={14} /> Import Excel
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importFile(f)
            }}
          />
        </div>
      </div>

      {/* Status of the saved opening journal */}
      <div
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13,
        }}
      >
        <FileSpreadsheet size={18} color="var(--accent-light)" />
        {existingLoading ? (
          <span style={{ color: 'var(--foreground-muted)' }}>Checking for an existing opening balance…</span>
        ) : existing ? (
          <>
            <span>
              Opening journal <strong>{existing.journal_number}</strong> · {formatDate(existing.date)}
            </span>
            <span
              style={{
                padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: isPosted ? 'var(--success-bg)' : 'var(--warning-bg)',
                color: isPosted ? 'var(--success)' : 'var(--warning)',
              }}
            >
              {isPosted ? 'Posted' : 'Draft'}
            </span>
            <span style={{ color: 'var(--foreground-muted)' }}>
              {isPosted
                ? 'Saving changes reverses this journal and creates a new draft to post.'
                : 'Changes replace this draft. Post it to put the balances into the books.'}
            </span>
          </>
        ) : (
          <span style={{ color: 'var(--foreground-muted)' }}>
            No opening balance yet — download the template, fill Debit/Credit per account, then import it.
          </span>
        )}
      </div>

      {/* Settings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Opening balance date *</span>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setDirty(true)
            }}
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: period ? 'var(--foreground-muted)' : 'var(--warning)' }}>
            {date ? (period ? `Period: ${period.name}${period.is_closed ? ' (closed)' : ''}` : 'No period covers this date') : 'Usually the first day you start using the system'}
          </span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={labelStyle}>Balancing account (for any difference)</span>
          <SearchableSelect
            value={balancingId}
            onChange={(v) => {
              setBalancingId(Number(v) || 0)
              setDirty(true)
            }}
            options={accountOptions}
            loading={accountsLoading}
            placeholder="-- Select equity account --"
            searchPlaceholder="Cari kode / nama akun..."
          />
          <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
            Defaults to “Historical Balancing” (equity) — move its balance to Modal / Laba Ditahan later
          </span>
        </div>
      </div>

      {issues.length > 0 && (
        <div
          style={{
            background: 'var(--destructive-bg)', border: '1px solid var(--destructive)', borderRadius: 'var(--radius-md)',
            padding: '12px 16px', fontSize: 13, color: 'var(--destructive)',
          }}
        >
          <strong>{issues.length} row(s) could not be imported</strong> — fix them in Excel and import again:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {issues.slice(0, 20).map((it) => (
              <li key={`${it.row}-${it.message}`}>Row {it.row}: {it.message}</li>
            ))}
            {issues.length > 20 && <li>…and {issues.length - 20} more</li>}
          </ul>
        </div>
      )}

      {/* Lines */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
                <th style={{ ...thStyle, width: 130 }}>Code</th>
                <th style={thStyle}>Account</th>
                <th style={{ ...thStyle, width: 90 }}>Normal</th>
                <th style={{ ...thStyle, width: 180, textAlign: 'right' }}>Debit</th>
                <th style={{ ...thStyle, width: 180, textAlign: 'right' }}>Credit</th>
                <th style={{ ...thStyle, width: 50 }} />
              </tr>
            </thead>
            <tbody>
              {(existingLoading || accountsLoading) && lines.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} style={tdStyle}>
                        <div style={{ height: 14, background: 'var(--border)', borderRadius: 4, opacity: 0.5 }} />
                      </td>
                    ))}
                  </tr>
                ))}
              {!existingLoading && !accountsLoading && lines.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', padding: 40, color: 'var(--foreground-muted)' }}>
                    No balances yet. Import the filled template, or add accounts one by one below.
                  </td>
                </tr>
              )}
              {sortedLines.map((l, n) => {
                const account = accountById.get(l.accountId)
                return (
                  <tr key={l.accountId}>
                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)' }}>{n + 1}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{account?.code ?? `#${l.accountId}`}</td>
                    <td style={tdStyle}>{account?.name ?? '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--foreground-muted)', textTransform: 'capitalize' }}>{account?.normal_balance ?? ''}</td>
                    <td style={tdStyle}>
                      <LocalizedNumberInput
                        value={l.debit}
                        onChange={(v) => updateLine(l.idx, { debit: Math.max(0, v || 0), credit: v > 0 ? 0 : l.credit })}
                        disabled={!canSave}
                        style={{ padding: '6px 10px', fontSize: 13 }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <LocalizedNumberInput
                        value={l.credit}
                        onChange={(v) => updateLine(l.idx, { credit: Math.max(0, v || 0), debit: v > 0 ? 0 : l.debit })}
                        disabled={!canSave}
                        style={{ padding: '6px 10px', fontSize: 13 }}
                      />
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {canSave && (
                        <button
                          type="button"
                          title="Remove"
                          onClick={() => {
                            setLines((prev) => prev.filter((_, i) => i !== l.idx))
                            setDirty(true)
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--foreground-muted)', padding: 4 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {difference !== 0 && lines.length > 0 && (
                <tr style={{ background: 'var(--accent-light-bg)' }}>
                  <td style={tdStyle} />
                  <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{accountById.get(balancingId)?.code ?? '—'}</td>
                  <td style={tdStyle}>
                    {accountById.get(balancingId)?.name ?? 'Balancing account not set'}{' '}
                    <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>(auto-balancing)</span>
                  </td>
                  <td style={tdStyle} />
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{difference < 0 ? fmtNumber(-difference) : ''}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{difference > 0 ? fmtNumber(difference) : ''}</td>
                  <td style={tdStyle} />
                </tr>
              )}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, fontWeight: 600, textAlign: 'right' }}>Total</td>
                  <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'right' }}>{fmtNumber(Math.max(totalDebit, totalCredit))}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, textAlign: 'right' }}>{fmtNumber(Math.max(totalDebit, totalCredit))}</td>
                  <td style={tdStyle} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {canSave && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ flex: 1, maxWidth: 420 }}>
              <SearchableSelect
                value={addAccountId}
                onChange={(v) => setAddAccountId(Number(v) || 0)}
                options={addOptions}
                loading={accountsLoading}
                placeholder="Add an account…"
                searchPlaceholder="Cari kode / nama akun..."
              />
            </div>
            <button
              type="button"
              style={btnStyle}
              disabled={!addAccountId}
              onClick={() => {
                setLines((prev) => [...prev, { accountId: addAccountId, debit: 0, credit: 0 }])
                setAddAccountId(0)
                setDirty(true)
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
          Debit {fmtNumber(totalDebit)} · Credit {fmtNumber(totalCredit)}
          {difference !== 0 && (
            <span style={{ color: 'var(--warning)' }}> · Difference {fmtNumber(Math.abs(difference))} goes to the balancing account</span>
          )}
          {blocking && lines.length > 0 && <div style={{ color: 'var(--destructive)', marginTop: 4 }}>{blocking}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canSave && (
            <button
              type="button"
              style={{ ...primaryBtnStyle, opacity: blocking || saving || (!dirty && !!existing) ? 0.5 : 1 }}
              disabled={!!blocking || saving || (!dirty && !!existing)}
              onClick={() => save()}
            >
              {saving ? 'Saving…' : isPosted ? 'Reverse & save new draft' : 'Save draft'}
            </button>
          )}
          {existing && !isPosted && canUpdate && (
            <button
              type="button"
              style={{ ...btnStyle, opacity: dirty || posting ? 0.5 : 1 }}
              disabled={dirty || posting}
              title={dirty ? 'Save the draft first' : undefined}
              onClick={() => setConfirmPost(true)}
            >
              Post
            </button>
          )}
        </div>
      </div>

      {confirmPost && existing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} onClick={() => setConfirmPost(false)} />
          <div
            style={{
              position: 'relative', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24,
              width: 420, maxWidth: 'calc(100vw - 32px)', boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>
              Post opening balance?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 20px' }}>
              {existing.journal_number} goes into the books and shows in every report. To change it afterwards, edit and save
              again — the posted journal is reversed and a new draft is created.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" style={btnStyle} onClick={() => setConfirmPost(false)}>Cancel</button>
              <button type="button" style={primaryBtnStyle} disabled={posting} onClick={() => post()}>
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
