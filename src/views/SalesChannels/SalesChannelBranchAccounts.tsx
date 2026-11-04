'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Search, Trash2, CheckCircle2, AlertCircle, Store } from 'lucide-react'
import {
  salesChannelsService,
  type SalesChannelBranchAccount,
} from '@/services/sales-channels.service'
import { branchesService } from '@/services/branches.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import SearchableSelect from '@/components/SearchableSelect'
import { useDebounce } from '@/hooks/useDebounce'
import { toastMutationApiError } from '@/utils/apiError'

interface Props {
  salesChannelId: number
  canEdit: boolean
}

/** One line per outlet: its saved accounts (if any) merged with branch info. */
interface OutletRow {
  branch_id: number
  name: string
  code?: string
  isPickup: boolean
  parentName?: string
  saved?: SalesChannelBranchAccount
}

type StatusFilter = 'all' | 'set' | 'unset'

const selectTriggerStyle = {
  height: 36,
  padding: '0 10px',
  fontSize: 13,
  borderRadius: 'var(--radius-sm)',
}

const controlStyle: React.CSSProperties = {
  height: 34,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--surface-raised)',
  fontSize: 13,
  color: 'var(--foreground)',
  outline: 'none',
  fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box',
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  background: 'var(--background)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--foreground)',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
}

const captionStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--foreground-muted)',
  marginBottom: 4,
  display: 'block',
}

const smallBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  height: 28,
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  fontSize: 12,
  color: 'var(--foreground)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const isConfigured = (row: OutletRow) =>
  !!(row.saved && (row.saved.receivable_chart_of_account_id || row.saved.fee_chart_of_account_id))

function AccountCell({ code, name, id }: { code?: string | null; name?: string | null; id?: number | null }) {
  if (!id) return <span style={{ color: 'var(--foreground-subtle)' }}>Belum diatur</span>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span>{name ?? `COA #${id}`}</span>
      {code && (
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {code}
        </span>
      )}
    </div>
  )
}

/**
 * "Akun per Outlet" untuk sales channel online: akun piutang marketplace dan
 * akun fee per cabang. Pickup point hanya boleh mengisi akun fee (piutang
 * mengikuti outlet induknya). Disimpan via PUT (full replace).
 *
 * Semua outlet ditampilkan sebagai tabel baca; satu baris bisa diedit
 * sekaligus, lalu seluruh daftar dikirim ulang.
 */
export default function SalesChannelBranchAccounts({ salesChannelId, canEdit }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<number>(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState({ receivable: 0, fee: 0 })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['sales-channel-branch-accounts', salesChannelId],
    queryFn: () => salesChannelsService.listBranchAccounts(salesChannelId).then((r) => r.data),
  })
  const savedAccounts: SalesChannelBranchAccount[] = useMemo(() => {
    const d = (accountsData as any)?.data
    return Array.isArray(d) ? d : (d?.data ?? [])
  }, [accountsData])

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', 'sc-branch-accounts'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name' } as any).then((r) => r.data),
  })
  const branches: any[] = useMemo(() => (branchesData as any)?.data ?? [], [branchesData])

  // Receivable and fee accounts must both be active, non-header, debit-normal.
  // Each picker searches on the server with its own term; the saved
  // account's label is added back by coaOptions() when not in the results.
  const [receivableSearch, setReceivableSearch] = useState('')
  const [feeSearch, setFeeSearch] = useState('')
  const receivableSearchDebounced = useDebounce(receivableSearch, 400)
  const feeSearchDebounced = useDebounce(feeSearch, 400)
  const coaQuery = (term: string) => ({
    queryKey: ['chart-of-accounts-sc-branch', term],
    staleTime: 60_000,
    placeholderData: (prev: any) => prev,
    queryFn: () =>
      chartOfAccountsService
        .list({
          per_page: 50,
          sort: 'code',
          'filter[is_header]': 'false',
          'filter[is_active]': 'true',
          'filter[normal_balance]': 'debit',
          'filter[search]': term || undefined,
        } as any)
        .then((r) => (r.data as any)?.data ?? []),
    enabled: canEdit && editingId != null,
  })
  const { data: receivableCoaData, isFetching: receivableCoaLoading } = useQuery(coaQuery(receivableSearchDebounced))
  const { data: feeCoaData, isFetching: feeCoaLoading } = useQuery(coaQuery(feeSearchDebounced))

  // Outlets and pickup points, plus any branch that already has a setting.
  const outletRows: OutletRow[] = useMemo(() => {
    const savedById = new Map(savedAccounts.map((a) => [Number(a.branch_id), a]))
    const byId = new Map(branches.map((b) => [Number(b.id), b]))
    const ids = new Set<number>()
    branches.forEach((b) => {
      if (!b.type || b.type === 'outlet' || b.format === 'pickup_point') ids.add(Number(b.id))
    })
    savedById.forEach((_a, id) => ids.add(id))
    return Array.from(ids)
      .map((id) => {
        const b = byId.get(id)
        const saved = savedById.get(id)
        return {
          branch_id: id,
          name: b?.name ?? saved?.branch_name ?? `Branch #${id}`,
          code: b?.code ?? saved?.branch_code,
          isPickup: b?.format === 'pickup_point',
          parentName: b?.parent_id ? byId.get(Number(b.parent_id))?.name : undefined,
          saved,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [branches, savedAccounts])

  const configuredCount = outletRows.filter(isConfigured).length

  const visibleRows = outletRows.filter((r) => {
    if (branchFilter && r.branch_id !== branchFilter) return false
    if (statusFilter === 'set' && !isConfigured(r)) return false
    if (statusFilter === 'unset' && isConfigured(r)) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    const s = r.saved
    return [r.name, r.code, s?.receivable_chart_of_account_name, s?.receivable_chart_of_account_code,
      s?.fee_chart_of_account_name, s?.fee_chart_of_account_code]
      .some((v) => String(v ?? '').toLowerCase().includes(q))
  })

  const coaOptions = (selectedId: number, kind: 'receivable' | 'fee') => {
    const coas: any[] = (kind === 'receivable' ? receivableCoaData : feeCoaData) ?? []
    const opts = coas.map((c) => ({ value: Number(c.id), label: c.name ?? `COA #${c.id}`, sublabel: c.code ?? undefined }))
    if (selectedId > 0 && !opts.some((o) => o.value === selectedId)) {
      const saved: any = savedAccounts.find((a: any) => Number(a[`${kind}_chart_of_account_id`]) === selectedId)
      opts.unshift({
        value: selectedId,
        label: saved?.[`${kind}_chart_of_account_name`] ?? `COA #${selectedId}`,
        sublabel: saved?.[`${kind}_chart_of_account_code`] ?? undefined,
      })
    }
    return opts
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (accounts: { branch_id: number; receivable_chart_of_account_id?: number; fee_chart_of_account_id?: number }[]) =>
      salesChannelsService.replaceBranchAccounts(salesChannelId, accounts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-channel-branch-accounts', salesChannelId] })
      toast.success('Akun outlet disimpan')
      setEditingId(null)
      setFieldErrors({})
    },
    onError: (err: any) => {
      // 422 keys: accounts.{i}.receivable_chart_of_account_id / fee_chart_of_account_id
      const errors = err?.response?.data?.errors
      if (errors && typeof errors === 'object') {
        const mapped: Record<string, string> = {}
        Object.entries(errors).forEach(([k, v]) => {
          const field = k.replace(/\[(\d+)\]/g, '.$1').replace(/^accounts\.\d+\./, '')
          mapped[field] = String(Array.isArray(v) ? v[0] : v)
        })
        setFieldErrors(mapped)
      }
      toastMutationApiError(err, 'Gagal menyimpan akun outlet')
    },
  })

  // PUT is a full replace: send every saved row, with the edited one swapped in.
  const submitWith = (branchId: number, next: { receivable: number; fee: number } | null) => {
    const others = savedAccounts
      .filter((a) => Number(a.branch_id) !== branchId)
      .map((a) => ({
        branch_id: Number(a.branch_id),
        receivable_chart_of_account_id: a.receivable_chart_of_account_id || undefined,
        fee_chart_of_account_id: a.fee_chart_of_account_id || undefined,
      }))
    const isPickup = outletRows.find((r) => r.branch_id === branchId)?.isPickup
    const edited = next
      ? [{
          branch_id: branchId,
          receivable_chart_of_account_id: !isPickup && next.receivable > 0 ? next.receivable : undefined,
          fee_chart_of_account_id: next.fee > 0 ? next.fee : undefined,
        }]
      : []
    save([...others, ...edited])
  }

  const startEdit = (row: OutletRow) => {
    setEditingId(row.branch_id)
    setDraft({
      receivable: Number(row.saved?.receivable_chart_of_account_id ?? 0),
      fee: Number(row.saved?.fee_chart_of_account_id ?? 0),
    })
    setFieldErrors({})
  }

  const handleSave = (row: OutletRow) => {
    const hasReceivable = !row.isPickup && draft.receivable > 0
    if (!hasReceivable && !(draft.fee > 0)) {
      toast.error(row.isPickup ? 'Pilih akun fee.' : 'Pilih akun piutang, akun fee, atau keduanya.')
      return
    }
    submitWith(row.branch_id, draft)
  }

  const handleClear = (row: OutletRow) => {
    if (!window.confirm(`Hapus pengaturan akun untuk ${row.name}?`)) return
    submitWith(row.branch_id, null)
  }

  const branchFilterOptions = [
    { value: 0, label: 'Semua outlet' },
    ...outletRows.map((r) => ({ value: r.branch_id, label: r.name, sublabel: r.code })),
  ]

  const statusChip = (value: StatusFilter, label: string) => {
    const active = statusFilter === value
    return (
      <button
        type="button"
        onClick={() => setStatusFilter(value)}
        style={{
          height: 30,
          padding: '0 12px',
          borderRadius: 99,
          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
          background: active ? 'var(--accent-light-bg)' : 'var(--surface)',
          color: active ? 'var(--accent)' : 'var(--foreground-muted)',
          fontSize: 12,
          fontWeight: active ? 600 : 500,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Akun per Outlet</div>
          <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '2px 0 0', lineHeight: 1.5 }}>
            Akun piutang marketplace dan akun fee yang dipakai saat payout tiap outlet.
          </p>
        </div>
        {!isLoading && !branchesLoading && (
          <span
            style={{
              flexShrink: 0,
              padding: '4px 10px',
              borderRadius: 99,
              fontSize: 12,
              fontWeight: 600,
              background: configuredCount === outletRows.length ? 'var(--success-bg)' : 'var(--warning-bg)',
              color: configuredCount === outletRows.length ? 'var(--success)' : 'var(--warning)',
            }}
          >
            {configuredCount}/{outletRows.length} outlet diatur
          </span>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-subtle)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari outlet atau akun..."
            style={{ ...controlStyle, width: '100%', paddingLeft: 30 }}
          />
        </div>
        <div style={{ flex: '1 1 180px' }}>
          <SearchableSelect
            value={branchFilter}
            onChange={(val: any) => setBranchFilter(Number(val) || 0)}
            options={branchFilterOptions}
            placeholder="Semua outlet"
            searchPlaceholder="Cari outlet..."
            loading={branchesLoading}
            triggerStyle={{ ...selectTriggerStyle, height: 34 }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {statusChip('all', 'Semua')}
        {statusChip('set', 'Sudah diatur')}
        {statusChip('unset', 'Belum diatur')}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '30%' }}>Outlet</th>
              <th style={thStyle}>Akun Piutang</th>
              <th style={thStyle}>Akun Fee</th>
              {canEdit && <th style={{ ...thStyle, width: 88 }} />}
            </tr>
          </thead>
          <tbody>
            {isLoading || branchesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: canEdit ? 4 : 3 }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{ height: 12, borderRadius: 4, background: 'var(--border)', width: j === 0 ? '70%' : '85%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 4 : 3} style={{ ...tdStyle, borderBottom: 'none', padding: '28px 12px', textAlign: 'center' }}>
                  <Store size={22} style={{ color: 'var(--foreground-subtle)', marginBottom: 6 }} />
                  <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Tidak ada outlet yang cocok.</div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const editing = editingId === row.branch_id
                const configured = isConfigured(row)
                const s = row.saved
                return editing ? (
                  <tr key={row.branch_id} style={{ background: 'var(--accent-light-bg)' }}>
                    <td colSpan={canEdit ? 4 : 3} style={tdStyle}>
                      <div style={{ fontWeight: 600, marginBottom: 10 }}>
                        {row.name}
                        {row.code && <span style={{ fontWeight: 400, color: 'var(--foreground-muted)' }}> · {row.code}</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                        <div>
                          <span style={captionStyle}>Akun piutang</span>
                          {row.isPickup ? (
                            <div style={{ ...controlStyle, height: 36, display: 'flex', alignItems: 'center', color: 'var(--foreground-muted)' }}>
                              Ikut {row.parentName ?? 'outlet induk'}
                            </div>
                          ) : (
                            <SearchableSelect
                              value={draft.receivable}
                              onChange={(val: any) => setDraft((d) => ({ ...d, receivable: Number(val) || 0 }))}
                              options={coaOptions(draft.receivable, 'receivable')}
                              placeholder="Pilih akun piutang"
                              searchPlaceholder="Cari nama atau kode akun..."
                              loading={receivableCoaLoading}
                              onSearchChange={setReceivableSearch}
                              error={fieldErrors.receivable_chart_of_account_id}
                              triggerStyle={selectTriggerStyle}
                            />
                          )}
                        </div>
                        <div>
                          <span style={captionStyle}>Akun fee</span>
                          <SearchableSelect
                            value={draft.fee}
                            onChange={(val: any) => setDraft((d) => ({ ...d, fee: Number(val) || 0 }))}
                            options={coaOptions(draft.fee, 'fee')}
                            placeholder="Pilih akun fee"
                            searchPlaceholder="Cari nama atau kode akun..."
                            loading={feeCoaLoading}
                            onSearchChange={setFeeSearch}
                            error={fieldErrors.fee_chart_of_account_id}
                            triggerStyle={selectTriggerStyle}
                          />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                        {configured && (
                          <button
                            type="button"
                            onClick={() => handleClear(row)}
                            disabled={saving}
                            style={{ ...smallBtn, color: 'var(--destructive)', marginRight: 'auto' }}
                          >
                            <Trash2 size={12} /> Hapus pengaturan
                          </button>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                          <button type="button" onClick={() => setEditingId(null)} disabled={saving} style={{ ...smallBtn, height: 32 }}>
                            Batal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSave(row)}
                            disabled={saving}
                            style={{
                              ...smallBtn,
                              height: 32,
                              border: 'none',
                              background: 'var(--accent)',
                              color: 'white',
                              fontWeight: 600,
                              cursor: saving ? 'not-allowed' : 'pointer',
                              opacity: saving ? 0.7 : 1,
                            }}
                          >
                            {saving ? 'Menyimpan...' : 'Simpan'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.branch_id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600 }}>{row.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                        {row.code && <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{row.code}</span>}
                        {row.isPickup && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: 'var(--info-bg)', color: 'var(--info)' }}>
                            Pickup point
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 6,
                          fontSize: 11,
                          color: configured ? 'var(--success)' : 'var(--warning)',
                        }}
                      >
                        {configured ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {configured ? 'Sudah diatur' : 'Belum diatur'}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {row.isPickup ? (
                        <span style={{ color: 'var(--foreground-muted)' }}>Ikut {row.parentName ?? 'outlet induk'}</span>
                      ) : (
                        <AccountCell
                          id={s?.receivable_chart_of_account_id}
                          code={s?.receivable_chart_of_account_code}
                          name={s?.receivable_chart_of_account_name}
                        />
                      )}
                    </td>
                    <td style={tdStyle}>
                      <AccountCell
                        id={s?.fee_chart_of_account_id}
                        code={s?.fee_chart_of_account_code}
                        name={s?.fee_chart_of_account_name}
                      />
                    </td>
                    {canEdit && (
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          disabled={saving || (editingId !== null && editingId !== row.branch_id)}
                          style={smallBtn}
                        >
                          <Pencil size={12} /> {configured ? 'Edit' : 'Atur'}
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
