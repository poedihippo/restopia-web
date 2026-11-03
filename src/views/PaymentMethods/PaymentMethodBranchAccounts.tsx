'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Pencil, Search, Trash2, CheckCircle2, CornerDownRight, Store } from 'lucide-react'
import {
  paymentMethodsService,
  type PaymentMethodBranchAccount,
} from '@/services/payment-methods.service'
import { branchesService } from '@/services/branches.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import SearchableSelect from '@/components/SearchableSelect'
import { toastMutationApiError } from '@/utils/apiError'

interface Props {
  paymentMethodId: number
  canEdit: boolean
  /** The payment method's own COA — used by every branch without an override. */
  defaultAccount?: { code?: string; name?: string } | null
}

/** One line per outlet: its override (if any) merged with branch info. */
interface OutletRow {
  branch_id: number
  name: string
  code?: string
  isPickup: boolean
  parentId?: number
  parentName?: string
  saved?: PaymentMethodBranchAccount
}

type StatusFilter = 'all' | 'custom' | 'default'

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

function AccountText({ code, name, muted }: { code?: string | null; name?: string | null; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, color: muted ? 'var(--foreground-muted)' : undefined }}>
      <span>{name ?? '—'}</span>
      {code && (
        <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontVariantNumeric: 'tabular-nums' }}>{code}</span>
      )}
    </div>
  )
}

/**
 * "Akun per Outlet": override COA payment method per cabang.
 * Pickup point mewarisi akun outlet induknya; cabang tanpa override memakai
 * akun payment method itu sendiri. Disimpan via PUT (full replace).
 *
 * Semua outlet ditampilkan sebagai tabel baca beserta akun yang efektif
 * dipakai; satu baris bisa diedit sekaligus, lalu seluruh daftar dikirim ulang.
 */
export default function PaymentMethodBranchAccounts({ paymentMethodId, canEdit, defaultAccount }: Props) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState<number>(0)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftCoa, setDraftCoa] = useState(0)
  const [fieldError, setFieldError] = useState('')

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['payment-method-branch-accounts', paymentMethodId],
    queryFn: () => paymentMethodsService.listBranchAccounts(paymentMethodId).then((r) => r.data),
  })
  const savedAccounts: PaymentMethodBranchAccount[] = useMemo(() => {
    const d = (accountsData as any)?.data
    return Array.isArray(d) ? d : (d?.data ?? [])
  }, [accountsData])

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', 'pm-branch-accounts'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name' } as any).then((r) => r.data),
  })
  const branches: any[] = useMemo(() => (branchesData as any)?.data ?? [], [branchesData])

  const { data: coaData, isLoading: coaLoading } = useQuery({
    queryKey: ['chart-of-accounts-pm-branch'],
    queryFn: () =>
      chartOfAccountsService
        .list({
          per_page: 1000,
          sort: 'code',
          'filter[is_header]': 'false',
          'filter[is_active]': 'true',
        } as any)
        .then((r) => (r.data as any)?.data ?? []),
    enabled: canEdit,
  })
  const coas: any[] = coaData ?? []

  // Outlets and pickup points, plus any branch that already has an override.
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
        const parentId = b?.parent_id ? Number(b.parent_id) : undefined
        return {
          branch_id: id,
          name: b?.name ?? savedById.get(id)?.branch_name ?? `Branch #${id}`,
          code: b?.code ?? savedById.get(id)?.branch_code,
          isPickup: b?.format === 'pickup_point',
          parentId,
          parentName: parentId ? byId.get(parentId)?.name : undefined,
          saved: savedById.get(id),
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [branches, savedAccounts])

  const savedById = useMemo(
    () => new Map(savedAccounts.map((a) => [Number(a.branch_id), a])),
    [savedAccounts],
  )

  /** Account actually used by a row: own override → parent's override (pickup) → default. */
  const effectiveOf = (row: OutletRow) => {
    if (row.isPickup) {
      const parent = row.parentId ? savedById.get(row.parentId) : undefined
      return parent
        ? { code: parent.chart_of_account_code, name: parent.chart_of_account_name, source: 'parent' as const }
        : { code: defaultAccount?.code, name: defaultAccount?.name, source: 'default' as const }
    }
    return row.saved
      ? { code: row.saved.chart_of_account_code, name: row.saved.chart_of_account_name ?? `COA #${row.saved.chart_of_account_id}`, source: 'custom' as const }
      : { code: defaultAccount?.code, name: defaultAccount?.name, source: 'default' as const }
  }

  const customCount = outletRows.filter((r) => !r.isPickup && r.saved).length

  const visibleRows = outletRows.filter((r) => {
    if (branchFilter && r.branch_id !== branchFilter) return false
    const custom = !r.isPickup && !!r.saved
    if (statusFilter === 'custom' && !custom) return false
    if (statusFilter === 'default' && custom) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    const eff = effectiveOf(r)
    return [r.name, r.code, eff.name, eff.code].some((v) => String(v ?? '').toLowerCase().includes(q))
  })

  const coaOptions = (selectedId: number) => {
    const opts = coas.map((c) => ({ value: Number(c.id), label: c.name ?? `COA #${c.id}`, sublabel: c.code ?? undefined }))
    if (selectedId > 0 && !opts.some((o) => o.value === selectedId)) {
      const saved = savedAccounts.find((a) => Number(a.chart_of_account_id) === selectedId)
      opts.unshift({
        value: selectedId,
        label: saved?.chart_of_account_name ?? `COA #${selectedId}`,
        sublabel: saved?.chart_of_account_code,
      })
    }
    return opts
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (accounts: { branch_id: number; chart_of_account_id: number }[]) =>
      paymentMethodsService.replaceBranchAccounts(paymentMethodId, accounts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-method-branch-accounts', paymentMethodId] })
      toast.success('Akun outlet disimpan')
      setEditingId(null)
      setFieldError('')
    },
    onError: (err: any) => {
      // 422 dikunci accounts.{i}.chart_of_account_id
      const errors = err?.response?.data?.errors
      if (errors && typeof errors === 'object') {
        const entry = Object.entries(errors).find(([k]) => k.endsWith('chart_of_account_id'))
        if (entry) setFieldError(String(Array.isArray(entry[1]) ? entry[1][0] : entry[1]))
      }
      toastMutationApiError(err, 'Gagal menyimpan akun outlet')
    },
  })

  // PUT is a full replace: send every saved row, with the edited one swapped in.
  const submitWith = (branchId: number, coaId: number | null) => {
    const others = savedAccounts
      .filter((a) => Number(a.branch_id) !== branchId)
      .map((a) => ({ branch_id: Number(a.branch_id), chart_of_account_id: Number(a.chart_of_account_id) }))
    save(coaId ? [...others, { branch_id: branchId, chart_of_account_id: coaId }] : others)
  }

  const startEdit = (row: OutletRow) => {
    setEditingId(row.branch_id)
    setDraftCoa(Number(row.saved?.chart_of_account_id ?? 0))
    setFieldError('')
  }

  const handleSave = (row: OutletRow) => {
    if (!draftCoa) {
      toast.error('Pilih akun, atau batalkan untuk tetap memakai akun default.')
      return
    }
    submitWith(row.branch_id, draftCoa)
  }

  const handleReset = (row: OutletRow) => {
    if (!window.confirm(`Kembalikan ${row.name} ke akun default?`)) return
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

  const colCount = canEdit ? 3 : 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>Akun per Outlet</div>
          <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '2px 0 0', lineHeight: 1.5 }}>
            Outlet tanpa akun khusus memakai akun default. Pickup point mengikuti outlet induknya.
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
              background: 'var(--accent-light-bg)',
              color: 'var(--accent)',
            }}
          >
            {customCount} akun khusus
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
        {statusChip('custom', 'Akun khusus')}
        {statusChip('default', 'Pakai default')}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '38%' }}>Outlet</th>
              <th style={thStyle}>Akun yang dipakai</th>
              {canEdit && <th style={{ ...thStyle, width: 96 }} />}
            </tr>
          </thead>
          <tbody>
            {isLoading || branchesLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: colCount }).map((__, j) => (
                    <td key={j} style={tdStyle}>
                      <div style={{ height: 12, borderRadius: 4, background: 'var(--border)', width: j === 0 ? '70%' : '85%' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} style={{ ...tdStyle, borderBottom: 'none', padding: '28px 12px', textAlign: 'center' }}>
                  <Store size={22} style={{ color: 'var(--foreground-subtle)', marginBottom: 6 }} />
                  <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Tidak ada outlet yang cocok.</div>
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => {
                const editing = editingId === row.branch_id
                const eff = effectiveOf(row)
                const custom = eff.source === 'custom'
                return editing ? (
                  <tr key={row.branch_id} style={{ background: 'var(--accent-light-bg)' }}>
                    <td colSpan={colCount} style={tdStyle}>
                      <div style={{ fontWeight: 600, marginBottom: 10 }}>
                        {row.name}
                        {row.code && <span style={{ fontWeight: 400, color: 'var(--foreground-muted)' }}> · {row.code}</span>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', marginBottom: 4, display: 'block' }}>
                        Akun khusus outlet ini
                      </span>
                      <SearchableSelect
                        value={draftCoa}
                        onChange={(val: any) => setDraftCoa(Number(val) || 0)}
                        options={coaOptions(draftCoa)}
                        placeholder="Pilih akun (COA)"
                        searchPlaceholder="Cari nama atau kode akun..."
                        loading={coaLoading}
                        error={fieldError || undefined}
                        triggerStyle={selectTriggerStyle}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                        {row.saved && (
                          <button
                            type="button"
                            onClick={() => handleReset(row)}
                            disabled={saving}
                            style={{ ...smallBtn, color: 'var(--destructive)' }}
                          >
                            <Trash2 size={12} /> Kembali ke default
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
                    </td>
                    <td style={tdStyle}>
                      <AccountText code={eff.code} name={eff.name} muted={!custom} />
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: 5,
                          fontSize: 11,
                          color: custom ? 'var(--success)' : 'var(--foreground-subtle)',
                        }}
                      >
                        {custom ? <CheckCircle2 size={12} /> : <CornerDownRight size={12} />}
                        {custom
                          ? 'Akun khusus'
                          : eff.source === 'parent'
                            ? `Ikut ${row.parentName ?? 'outlet induk'}`
                            : 'Akun default'}
                      </div>
                    </td>
                    {canEdit && (
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        {!row.isPickup && (
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            disabled={saving || (editingId !== null && editingId !== row.branch_id)}
                            style={smallBtn}
                          >
                            <Pencil size={12} /> {custom ? 'Edit' : 'Atur'}
                          </button>
                        )}
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
