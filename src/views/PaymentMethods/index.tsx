'use client'
import { formatDateShort, formatDateTime } from '@/utils/date';

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, X, Search } from 'lucide-react'
import { paymentMethodsService as paymentMethodService } from '@/services/payment-methods.service'
import { useAuth } from '@/hooks/useAuth'

export default function PaymentMethodsView() {
  const router = useRouter()
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("payment-method.read");
  const canCreate = hasPermission('payment-method.create')
  const canEdit = hasPermission('payment-method.update')
  const canDelete = hasPermission('payment-method.delete')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState('all')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [selectedItem, setSelectedItem] = useState<{
    id: number
    name: string
    type?: string
    chart_of_account_id?: number | null
    bank_account_id?: number | null
    bank_account?: {
      id: number
      bank_name: string
      account_number: string
      account_name: string
    } | null
    created_at?: string
  } | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [originFilter, setOriginFilter] = useState<'all' | 'manual' | 'bank' | 'coa'>('all')
  const [bankAccountFilter, setBankAccountFilter] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    if (!router.isReady) return
    const raw = router.query['filter[bank_account_id]']
    const id = raw ? Number(Array.isArray(raw) ? raw[0] : raw) : NaN
    if (!isNaN(id) && id > 0) {
      setOriginFilter('bank')
      setBankAccountFilter(id)
    }
  }, [router.isReady, router.query])

  const { data, isLoading } = useQuery({
    queryKey: ['payment-methods', debouncedSearch],
    queryFn: () =>
      paymentMethodService
        .list({
          per_page: 100,
          sort: 'id',
          include: 'bank_account',
          'filter[search]': debouncedSearch || undefined,
        } as any)
        .then((r) => r.data),
  })
  const allItems = (data as any)?.data ?? []
  const items = allItems.filter((item: any) => {
    if (bankAccountFilter && item.bank_account_id !== bankAccountFilter) return false
    if (originFilter === 'manual') return !item.bank_account_id && !item.chart_of_account_id
    if (originFilter === 'bank') return !!item.bank_account_id
    if (originFilter === 'coa') return !!item.chart_of_account_id && !item.bank_account_id
    return true
  })

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      editing
        ? paymentMethodService.update(editing.id, { name, type })
        : paymentMethodService.create({ name, type }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-methods'] })
      qc.invalidateQueries({ queryKey: ['payment-methods-all'] })
      toast.success(editing ? 'Updated' : 'Created')
      setShowForm(false)
      setEditing(null)
      setName('')
      setType('all')
    },
    onError: (err: any) => {
      const errData = err?.response?.data
      if (errData?.errors) {
        Object.values(errData.errors)
          .flat()
          .forEach((m: any) => toast.error(String(m)))
      } else {
        toast.error(errData?.message ?? 'Error')
      }
    },
  })

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (id: number) => paymentMethodService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-methods'] })
      qc.invalidateQueries({ queryKey: ['payment-methods-all'] })
      toast.success('Deleted')
      setDeleteTarget(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Error'),
  })

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--foreground-muted)',
    borderBottom: '1px solid var(--border)',
  }
  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    fontSize: 14,
    color: 'var(--foreground)',
    borderBottom: '1px solid var(--border)',
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 700,
              color: 'var(--foreground)',
              margin: 0,
            }}
          >
            Payment Methods
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            Manage accepted payment methods for POS checkout
          </p>
        </div>
        {canCreate && (<button
          type="button"
          onClick={() => {
            setEditing(null)
            setName('')
            setType('all')
            setShowForm(true)
          }}
          style={{
            height: 40,
            padding: '0 20px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}>+ Add Method
                              </button>)}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', maxWidth: 280, minWidth: 220 }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--foreground-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payment methods..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface-raised)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { key: 'all', label: 'All' },
            { key: 'manual', label: 'Manual' },
            { key: 'bank', label: 'Bank-linked' },
            { key: 'coa', label: 'COA-linked' },
          ] as const).map((tab) => {
            const active = originFilter === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setOriginFilter(tab.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? 'white' : 'var(--foreground-muted)',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          maxWidth: 720,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Type</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Bank Account</th>
              <th style={thStyle}>Created</th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5, 6].map((j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 16,
                          background: 'var(--border)',
                          borderRadius: 4,
                          opacity: 0.5,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: 40,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No payment methods yet. Add Cash, Transfer, or QRIS to get started.
                </td>
              </tr>
            )}
            {items.map((item: any) => {
              const isBankLinked = !!item.bank_account_id
              return (
                <tr key={item.id}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{canRead ? item.name : "***"}</td>
                  <td style={tdStyle}>{canRead ? (item.type || '—') : "***"}</td>
                  <td style={tdStyle}>
                    {canRead ? (
                      item.bank_account_id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'var(--info-bg)', color: 'var(--info)' }}>
                          Bank
                        </span>
                      ) : item.chart_of_account_id ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'var(--accent-light-bg)', color: 'var(--accent)' }}>
                          COA
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--foreground-muted)' }}>
                          Manual
                        </span>
                      )
                    ) : "***"}
                  </td>
                  <td style={tdStyle}>
                    {canRead ? (
                      isBankLinked ? (
                        <span style={{ fontSize: 13, color: 'var(--foreground)' }}>
                          {item.bank_account?.bank_name ?? 'Bank'}
                          <span style={{ color: 'var(--foreground-muted)', marginLeft: 6, fontFamily: 'monospace' }}>
                            {item.bank_account?.account_number ?? ''}
                          </span>
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>—</span>
                      )
                    ) : "***"}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                    {canRead ? item.created_at
                      ? formatDateShort(item.created_at)
                      : '—' : "***"}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        title="View"
                        style={{
                          padding: 6,
                          background: 'none',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          color: 'var(--foreground-muted)',
                          display: 'flex',
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      {canEdit && !isBankLinked && (<button
                        type="button"
                        onClick={() => {
                          setEditing(item)
                          setName(item.name)
                          setType(item.type || 'all')
                          setShowForm(true)
                        }}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface)',
                          cursor: 'pointer',
                        }}>Edit
                                                                     </button>)}
                      {canDelete && !isBankLinked && (<button
                        type="button"
                        onClick={() => setDeleteTarget(item)}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          border: '1px solid var(--destructive)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: 'var(--destructive)',
                        }}>Delete
                                                                     </button>)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            role="presentation"
            onClick={() => setShowForm(false)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.18)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 50,
              width: 400,
              height: '100%',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}
              >
                {editing ? 'Edit Payment Method' : 'New Payment Method'}
              </span>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, padding: 24 }}>
              {editing?.bank_account_id ? (
                <div
                  style={{
                    padding: 16,
                    background: 'var(--warning-bg)',
                    border: '1px solid var(--warning)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--warning)',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  This payment method is linked to bank account{' '}
                  <strong>
                    {editing.bank_account?.bank_name ?? 'Bank'} {editing.bank_account?.account_number ?? ''}
                  </strong>.
                  Changes must be made on the Bank Accounts page.
                </div>
              ) : (
                <>
                  <label
                    style={{
                      fontSize: 13,
                      color: 'var(--foreground-muted)',
                      display: 'block',
                      marginBottom: 6,
                    }}
                  >
                    Method Name *
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Cash, Transfer BCA, QRIS"
                    style={{
                      width: '100%',
                      height: 40,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0 12px',
                      fontSize: 14,
                      color: 'var(--foreground)',
                      background: 'var(--surface-raised)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <p style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 6 }}>
                    Tip: include &quot;cash&quot; in the name (e.g. &quot;Cash&quot;) to enable change
                    calculation in POS.
                  </p>
                  <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6, marginTop: 16 }}>
                    Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    style={{ width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box' }}
                  >
                    <option value="all">All</option>
                    <option value="sales_orders">Sales Orders</option>
                    <option value="purchase_orders">Purchase Orders</option>
                  </select>
                </>
              )}
            </div>
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  flex: 1,
                  height: 42,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              {!editing?.bank_account_id && (
                <button
                  type="button"
                  onClick={() => {
                    if (!name.trim()) {
                      toast.error('Name is required')
                      return
                    }
                    save()
                  }}
                  disabled={saving}
                  style={{
                    flex: 1,
                    height: 42,
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--accent)',
                    color: 'white',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            onClick={() => setSelectedItem(null)}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.18)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 50,
              width: 420,
              height: '100%',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 18,
                  fontWeight: 500,
                  margin: 0,
                  color: 'var(--foreground)',
                }}
              >
                Payment Method Detail
              </h2>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <X size={18} color="var(--foreground-muted)" />
              </button>
            </div>
            <div
              style={{
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {[
                { label: 'ID', value: selectedItem.id },
                { label: 'Name', value: selectedItem.name },
                { label: 'Type', value: selectedItem.type },
                {
                  label: 'Chart of Account ID',
                  value: selectedItem.chart_of_account_id ?? '—',
                },
                {
                  label: 'Bank Account',
                  value: selectedItem.bank_account
                    ? `${selectedItem.bank_account.bank_name} — ${selectedItem.bank_account.account_number} (${selectedItem.bank_account.account_name})`
                    : selectedItem.bank_account_id
                      ? `Linked to bank account #${selectedItem.bank_account_id}`
                      : '—',
                },
                {
                  label: 'Created At',
                  value: selectedItem.created_at
                    ? formatDateTime(selectedItem.created_at)
                    : '—',
                },
              ].map((f) => (
                <div
                  key={f.label}
                  style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--foreground-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.6px',
                    }}
                  >
                    {f.label}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                    {f.value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: 32,
              width: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                marginBottom: 8,
              }}
            >
              Delete Payment Method
            </h3>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginBottom: 24 }}>
              Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  height: 40,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--surface)',
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete(deleteTarget.id)}
                disabled={deleting}
                style={{
                  flex: 1,
                  height: 40,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--destructive)',
                  color: 'white',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
