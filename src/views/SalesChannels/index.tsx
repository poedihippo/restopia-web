'use client'
import { formatDateShort, formatDateTime } from '@/utils/date';

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, X, Search } from 'lucide-react'
import { salesChannelsService } from '@/services/sales-channels.service'
import { useAuth } from '@/hooks/useAuth'

export default function SalesChannelsView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("sales-channel.read");
  const canCreate = hasPermission('sales-channel.create')
  const canEdit = hasPermission('sales-channel.update')
  const canDelete = hasPermission('sales-channel.delete')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [name, setName] = useState('')
  const [salesOrderType, setSalesOrderType] = useState('offline')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [selectedItem, setSelectedItem] = useState<{
    id: number
    name: string
    sales_order_type?: string
    created_at?: string
  } | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['sales-channels', debouncedSearch],
    queryFn: () =>
      salesChannelsService
        .list({
          per_page: 1000,
          sort: 'id',
          'filter[search]': debouncedSearch || undefined,
        } as any)
        .then((r) => r.data),
  })
  const items = (data as any)?.data ?? []

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      editing
        ? salesChannelsService.update(editing.id, { name, sales_order_type: salesOrderType })
        : salesChannelsService.create({ name, sales_order_type: salesOrderType }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-channels'] })
      qc.invalidateQueries({ queryKey: ['sales-channels-all'] })
      toast.success(editing ? 'Updated' : 'Created')
      setShowForm(false)
      setEditing(null)
      setName('')
      setSalesOrderType('offline')
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
    mutationFn: (id: string) => salesChannelsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-channels'] })
      qc.invalidateQueries({ queryKey: ['sales-channels-all'] })
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
            Sales Channels
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            Manage sales channels for orders
          </p>
        </div>
        {canCreate && (<button
          type="button"
          onClick={() => {
            setEditing(null)
            setName('')
            setSalesOrderType('offline')
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
          }}>+ Add Channel
        </button>)}
      </div>
      <div style={{ marginBottom: 16, position: 'relative', maxWidth: 280 }}>
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
          placeholder="Search sales channels..."
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
              <th style={thStyle}>Sales Order Type</th>
              <th style={thStyle}>Created</th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4].map((j) => (
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
                  colSpan={4}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: 40,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No sales channels yet. Add one to get started.
                </td>
              </tr>
            )}
            {items.map((item: any, idx: number) => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                  {idx + 1}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{canRead ? item.name : "***"}</td>
                <td style={tdStyle}>{canRead ? (item.sales_order_type || '—') : "***"}</td>
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
                    {canEdit && (<button
                      type="button"
                      onClick={() => {
                        setEditing(item)
                        setName(item.name)
                        setSalesOrderType(item.sales_order_type || 'offline')
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
                    {canDelete && (<button
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
                {editing ? 'Edit Sales Channel' : 'New Sales Channel'}
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
                Channel Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Walk-in, Gojek, Grab"
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
              <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6, marginTop: 16 }}>
                Sales Order Type *
              </label>
              <select
                value={salesOrderType}
                onChange={(e) => setSalesOrderType(e.target.value)}
                style={{ width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box' }}
              >
                <option value="offline">Offline</option>
                <option value="online">Online</option>
                <option value="franchise">Franchise</option>
              </select>
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
                Sales Channel Detail
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
                { label: 'Sales Order Type', value: selectedItem.sales_order_type },
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
              Delete Sales Channel
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
