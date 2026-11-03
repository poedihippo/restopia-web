'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import {
  salesChannelsService,
  type SalesChannelBranchAccount,
} from '@/services/sales-channels.service'
import { branchesService } from '@/services/branches.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import SearchableSelect from '@/components/SearchableSelect'
import { toastMutationApiError } from '@/utils/apiError'

interface Row {
  key: number
  branch_id: number
  receivable_chart_of_account_id: number
  fee_chart_of_account_id: number
}

interface Props {
  salesChannelId: number
  canEdit: boolean
}

const selectTriggerStyle = {
  height: 36,
  padding: '0 10px',
  fontSize: 13,
  borderRadius: 'var(--radius-sm)',
}

const fieldCaptionStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--foreground-muted)',
}

let rowSeq = 0
const nextKey = () => ++rowSeq

const toRows = (accounts: SalesChannelBranchAccount[]): Row[] =>
  accounts.map((a) => ({
    key: nextKey(),
    branch_id: Number(a.branch_id),
    receivable_chart_of_account_id: Number(a.receivable_chart_of_account_id ?? 0),
    fee_chart_of_account_id: Number(a.fee_chart_of_account_id ?? 0),
  }))

/**
 * "Akun per Outlet" untuk sales channel online: akun piutang marketplace dan
 * akun fee per cabang. Pickup point hanya boleh mengisi akun fee (piutang
 * mengikuti outlet induknya). Disimpan via PUT (full replace).
 */
export default function SalesChannelBranchAccounts({ salesChannelId, canEdit }: Props) {
  const qc = useQueryClient()
  const [rows, setRows] = useState<Row[]>([])
  const [dirty, setDirty] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['sales-channel-branch-accounts', salesChannelId],
    queryFn: () => salesChannelsService.listBranchAccounts(salesChannelId).then((r) => r.data),
  })
  const savedAccounts: SalesChannelBranchAccount[] = useMemo(() => {
    const d = (accountsData as any)?.data
    return Array.isArray(d) ? d : (d?.data ?? [])
  }, [accountsData])

  useEffect(() => {
    setRows(toRows(savedAccounts))
    setDirty(false)
    setFieldErrors({})
  }, [savedAccounts])

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', 'sc-branch-accounts'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name' } as any).then((r) => r.data),
    enabled: canEdit,
  })
  const branches: any[] = (branchesData as any)?.data ?? []
  const isPickupPoint = (branchId: number) =>
    branches.find((b) => Number(b.id) === branchId)?.format === 'pickup_point'

  // Receivable and fee accounts must both be active, non-header, debit-normal.
  const { data: coaData, isLoading: coaLoading } = useQuery({
    queryKey: ['chart-of-accounts-sc-branch'],
    queryFn: () =>
      chartOfAccountsService
        .list({
          per_page: 1000,
          sort: 'code',
          'filter[is_header]': 'false',
          'filter[is_active]': 'true',
          'filter[normal_balance]': 'debit',
        } as any)
        .then((r) => (r.data as any)?.data ?? []),
    enabled: canEdit,
  })
  const coas: any[] = coaData ?? []

  const savedById = useMemo(() => {
    const m = new Map<number, SalesChannelBranchAccount>()
    savedAccounts.forEach((a) => m.set(Number(a.branch_id), a))
    return m
  }, [savedAccounts])

  const branchOptionsFor = (row: Row) => {
    const usedElsewhere = new Set(rows.filter((r) => r.key !== row.key).map((r) => r.branch_id))
    const opts = branches
      .filter((b) => !usedElsewhere.has(Number(b.id)))
      .map((b) => ({
        value: Number(b.id),
        label: b.name ?? `Branch #${b.id}`,
        sublabel: [b.code, b.format === 'pickup_point' ? 'Pickup point' : null].filter(Boolean).join(' · ') || undefined,
      }))
    const saved = savedById.get(row.branch_id)
    if (row.branch_id > 0 && !opts.some((o) => o.value === row.branch_id)) {
      opts.unshift({ value: row.branch_id, label: saved?.branch_name ?? `Branch #${row.branch_id}`, sublabel: saved?.branch_code })
    }
    return opts
  }

  const coaOptionsFor = (selectedId: number, kind: 'receivable' | 'fee') => {
    const opts = coas.map((c) => ({ value: Number(c.id), label: c.name ?? `COA #${c.id}`, sublabel: c.code ?? undefined }))
    if (selectedId > 0 && !opts.some((o) => o.value === selectedId)) {
      const saved: any = savedAccounts.find(
        (a: any) => Number(a[`${kind}_chart_of_account_id`]) === selectedId,
      )
      opts.unshift({
        value: selectedId,
        label: saved?.[`${kind}_chart_of_account_name`] ?? `COA #${selectedId}`,
        sublabel: saved?.[`${kind}_chart_of_account_code`] ?? undefined,
      })
    }
    return opts
  }

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
    setDirty(true)
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      salesChannelsService.replaceBranchAccounts(
        salesChannelId,
        rows.map((r) => ({
          branch_id: r.branch_id,
          receivable_chart_of_account_id:
            !isPickupPoint(r.branch_id) && r.receivable_chart_of_account_id > 0
              ? r.receivable_chart_of_account_id
              : undefined,
          fee_chart_of_account_id: r.fee_chart_of_account_id > 0 ? r.fee_chart_of_account_id : undefined,
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-channel-branch-accounts', salesChannelId] })
      toast.success('Akun per outlet disimpan')
      setDirty(false)
      setFieldErrors({})
    },
    onError: (err: any) => {
      // 422 keys: accounts.{i}.receivable_chart_of_account_id / fee_chart_of_account_id / branch_id
      const errors = err?.response?.data?.errors
      if (errors && typeof errors === 'object') {
        const mapped: Record<string, string> = {}
        Object.entries(errors).forEach(([k, v]) => {
          mapped[k.replace(/\[(\d+)\]/g, '.$1')] = String(Array.isArray(v) ? v[0] : v)
        })
        setFieldErrors(mapped)
      }
      toastMutationApiError(err, 'Gagal menyimpan akun per outlet')
    },
  })

  const handleSave = () => {
    if (rows.some((r) => !r.branch_id)) {
      toast.error('Pilih outlet di setiap baris, atau hapus baris yang kosong.')
      return
    }
    const missing = rows.find((r) => {
      const receivable = !isPickupPoint(r.branch_id) && r.receivable_chart_of_account_id > 0
      return !receivable && !(r.fee_chart_of_account_id > 0)
    })
    if (missing) {
      toast.error('Setiap baris butuh akun piutang, akun fee, atau keduanya.')
      return
    }
    save()
  }

  const handleReset = () => {
    setRows(toRows(savedAccounts))
    setDirty(false)
    setFieldErrors({})
  }

  const errorText = (idx: number, field: keyof Omit<Row, 'key'>) =>
    fieldErrors[`accounts.${idx}.${field}`]

  const accountLabel = (code?: string | null, name?: string | null, id?: number | null) =>
    id ? `${code ? `${code} — ` : ''}${name ?? `COA #${id}`}` : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--foreground-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          Akun per Outlet
        </span>
        <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
          Akun piutang marketplace dan akun fee per outlet. Pickup point hanya mengisi akun fee; piutangnya
          mengikuti outlet induk.
        </p>
      </div>

      {isLoading ? (
        <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Loading...</div>
      ) : !canEdit ? (
        savedAccounts.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Belum ada pengaturan per outlet.</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {savedAccounts.map((a, i) => (
              <div
                key={a.branch_id}
                style={{
                  padding: '10px 12px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                  {a.branch_name ?? `Branch #${a.branch_id}`}
                  {a.branch_code ? <span style={{ fontWeight: 400, color: 'var(--foreground-muted)' }}> · {a.branch_code}</span> : null}
                </span>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Piutang: {accountLabel(a.receivable_chart_of_account_code, a.receivable_chart_of_account_name, a.receivable_chart_of_account_id)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  Fee: {accountLabel(a.fee_chart_of_account_code, a.fee_chart_of_account_name, a.fee_chart_of_account_id)}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {rows.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--foreground-muted)',
                padding: '12px',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
              }}
            >
              Belum ada pengaturan per outlet.
            </div>
          )}

          {rows.map((row, idx) => {
            const pickup = isPickupPoint(row.branch_id)
            return (
              <div
                key={row.key}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: 10,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--background)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <SearchableSelect
                      value={row.branch_id}
                      onChange={(val: any) => updateRow(row.key, { branch_id: Number(val) || 0 })}
                      options={branchOptionsFor(row)}
                      placeholder="Pilih outlet"
                      searchPlaceholder="Cari outlet..."
                      loading={branchesLoading}
                      error={errorText(idx, 'branch_id')}
                      triggerStyle={selectTriggerStyle}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Hapus baris"
                    onClick={() => {
                      setRows((prev) => prev.filter((r) => r.key !== row.key))
                      setDirty(true)
                    }}
                    style={{
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={14} color="var(--destructive)" />
                  </button>
                </div>
                {!pickup && (
                  <>
                    <span style={fieldCaptionStyle}>Akun piutang</span>
                    <SearchableSelect
                      value={row.receivable_chart_of_account_id}
                      onChange={(val: any) => updateRow(row.key, { receivable_chart_of_account_id: Number(val) || 0 })}
                      options={coaOptionsFor(row.receivable_chart_of_account_id, 'receivable')}
                      placeholder="Pilih akun piutang"
                      searchPlaceholder="Cari nama atau kode akun..."
                      loading={coaLoading}
                      error={errorText(idx, 'receivable_chart_of_account_id')}
                      triggerStyle={selectTriggerStyle}
                    />
                  </>
                )}
                <span style={fieldCaptionStyle}>Akun fee</span>
                <SearchableSelect
                  value={row.fee_chart_of_account_id}
                  onChange={(val: any) => updateRow(row.key, { fee_chart_of_account_id: Number(val) || 0 })}
                  options={coaOptionsFor(row.fee_chart_of_account_id, 'fee')}
                  placeholder="Pilih akun fee"
                  searchPlaceholder="Cari nama atau kode akun..."
                  loading={coaLoading}
                  error={errorText(idx, 'fee_chart_of_account_id')}
                  triggerStyle={selectTriggerStyle}
                />
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => {
              setRows((prev) => [
                ...prev,
                { key: nextKey(), branch_id: 0, receivable_chart_of_account_id: 0, fee_chart_of_account_id: 0 },
              ])
              setDirty(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 36,
              border: '1px dashed var(--border-strong)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} /> Tambah Outlet
          </button>

          {dirty && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 36,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 36,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? 'Menyimpan...' : 'Simpan Akun Outlet'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
