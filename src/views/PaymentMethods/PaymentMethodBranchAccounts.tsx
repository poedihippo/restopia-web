'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import {
  paymentMethodsService,
  type PaymentMethodBranchAccount,
} from '@/services/payment-methods.service'
import { branchesService } from '@/services/branches.service'
import { chartOfAccountsService } from '@/services/accounting.service'
import SearchableSelect from '@/components/SearchableSelect'
import { toastMutationApiError } from '@/utils/apiError'

interface Row {
  key: number
  branch_id: number
  chart_of_account_id: number
}

interface Props {
  paymentMethodId: number
  canEdit: boolean
}

const selectTriggerStyle = {
  height: 36,
  padding: '0 10px',
  fontSize: 13,
  borderRadius: 'var(--radius-sm)',
}

let rowSeq = 0
const nextKey = () => ++rowSeq

/**
 * "Akun per Outlet": override COA payment method per cabang.
 * Pickup point mewarisi akun outlet induknya; cabang tanpa override memakai
 * akun payment method itu sendiri. Disimpan via PUT (full replace).
 */
export default function PaymentMethodBranchAccounts({ paymentMethodId, canEdit }: Props) {
  const qc = useQueryClient()
  const [rows, setRows] = useState<Row[]>([])
  const [dirty, setDirty] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const { data: accountsData, isLoading } = useQuery({
    queryKey: ['payment-method-branch-accounts', paymentMethodId],
    queryFn: () => paymentMethodsService.listBranchAccounts(paymentMethodId).then((r) => r.data),
  })
  const savedAccounts: PaymentMethodBranchAccount[] = useMemo(() => {
    const d = (accountsData as any)?.data
    return Array.isArray(d) ? d : (d?.data ?? [])
  }, [accountsData])

  useEffect(() => {
    setRows(
      savedAccounts.map((a) => ({
        key: nextKey(),
        branch_id: Number(a.branch_id),
        chart_of_account_id: Number(a.chart_of_account_id),
      })),
    )
    setDirty(false)
    setFieldErrors({})
  }, [savedAccounts])

  const { data: branchesData, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches-all', 'pm-branch-accounts'],
    queryFn: () => branchesService.list({ per_page: 1000, sort: 'name' } as any).then((r) => r.data),
    enabled: canEdit,
  })
  const branches: any[] = (branchesData as any)?.data ?? []

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

  // Label dari response GET dipakai sebagai fallback bila cabang/akun tidak
  // ada di list (mis. belum termuat atau sudah nonaktif).
  const savedById = useMemo(() => {
    const m = new Map<number, PaymentMethodBranchAccount>()
    savedAccounts.forEach((a) => m.set(Number(a.branch_id), a))
    return m
  }, [savedAccounts])

  const branchOptionsFor = (row: Row) => {
    const usedElsewhere = new Set(rows.filter((r) => r.key !== row.key).map((r) => r.branch_id))
    const opts = branches
      // Pickup point mewarisi akun outlet induk — tidak perlu override.
      .filter((b) => b.format !== 'pickup_point' && !usedElsewhere.has(Number(b.id)))
      .map((b) => ({ value: Number(b.id), label: b.name ?? `Branch #${b.id}`, sublabel: b.code ?? undefined }))
    const saved = savedById.get(row.branch_id)
    if (row.branch_id > 0 && !opts.some((o) => o.value === row.branch_id)) {
      opts.unshift({ value: row.branch_id, label: saved?.branch_name ?? `Branch #${row.branch_id}`, sublabel: saved?.branch_code })
    }
    return opts
  }

  const coaOptionsFor = (row: Row) => {
    const opts = coas.map((c) => ({ value: Number(c.id), label: c.name ?? `COA #${c.id}`, sublabel: c.code ?? undefined }))
    if (row.chart_of_account_id > 0 && !opts.some((o) => o.value === row.chart_of_account_id)) {
      const saved = savedAccounts.find((a) => Number(a.chart_of_account_id) === row.chart_of_account_id)
      opts.unshift({
        value: row.chart_of_account_id,
        label: saved?.chart_of_account_name ?? `COA #${row.chart_of_account_id}`,
        sublabel: saved?.chart_of_account_code,
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
      paymentMethodsService.replaceBranchAccounts(
        paymentMethodId,
        rows.map((r) => ({ branch_id: r.branch_id, chart_of_account_id: r.chart_of_account_id })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-method-branch-accounts', paymentMethodId] })
      toast.success('Akun per outlet disimpan')
      setDirty(false)
      setFieldErrors({})
    },
    onError: (err: any) => {
      // 422 dikunci accounts.{i}.branch_id / accounts.{i}.chart_of_account_id
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
    if (rows.some((r) => !r.branch_id || !r.chart_of_account_id)) {
      toast.error('Lengkapi outlet dan akun di setiap baris, atau hapus baris yang kosong.')
      return
    }
    save()
  }

  const handleReset = () => {
    setRows(
      savedAccounts.map((a) => ({
        key: nextKey(),
        branch_id: Number(a.branch_id),
        chart_of_account_id: Number(a.chart_of_account_id),
      })),
    )
    setDirty(false)
    setFieldErrors({})
  }

  const errorText = (idx: number, field: 'branch_id' | 'chart_of_account_id') =>
    fieldErrors[`accounts.${idx}.${field}`]

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
          Akun kas/bank khusus per outlet. Pickup point mengikuti akun outlet induknya; cabang tanpa pengaturan
          memakai akun payment method di atas.
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
                  {a.chart_of_account_code ? `${a.chart_of_account_code} — ` : ''}
                  {a.chart_of_account_name ?? `COA #${a.chart_of_account_id}`}
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

          {rows.map((row, idx) => (
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
              <SearchableSelect
                value={row.chart_of_account_id}
                onChange={(val: any) => updateRow(row.key, { chart_of_account_id: Number(val) || 0 })}
                options={coaOptionsFor(row)}
                placeholder="Pilih akun (COA)"
                searchPlaceholder="Cari nama atau kode akun..."
                loading={coaLoading}
                error={errorText(idx, 'chart_of_account_id')}
                triggerStyle={selectTriggerStyle}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setRows((prev) => [...prev, { key: nextKey(), branch_id: 0, chart_of_account_id: 0 }])
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
