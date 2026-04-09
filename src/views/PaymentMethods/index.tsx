'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import paymentMethodService from '@/services/payment-method.service'

export default function PaymentMethodsView() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () =>
      paymentMethodService.list({ per_page: 50, sort: 'id' }).then((r) => r.data),
  })
  const items = (data as any)?.data ?? []

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      editing
        ? paymentMethodService.update(editing.id, { name })
        : paymentMethodService.create({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-methods'] })
      qc.invalidateQueries({ queryKey: ['payment-methods-all'] })
      toast.success(editing ? 'Updated' : 'Created')
      setShowForm(false)
      setEditing(null)
      setName('')
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
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setName('')
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
          }}
        >
          + Add Method
        </button>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          maxWidth: 600,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Created</th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3].map((j) => (
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
                  colSpan={3}
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
            {items.map((item: any) => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString('id-ID')
                    : '—'}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(item)
                        setName(item.name)
                        setShowForm(true)
                      }}
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface)',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    <button
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
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
                  background: 'var(--surface)',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 6 }}>
                Tip: include &quot;cash&quot; in the name (e.g. &quot;Cash&quot;) to enable change
                calculation in POS.
              </p>
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
  )
}
