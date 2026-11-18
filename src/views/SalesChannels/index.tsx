'use client'
import { formatDateShort, formatDateTime } from '@/utils/date';

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, X, Globe, Store, BookOpen } from 'lucide-react'
import { FilterBar, FilterSelect, countActive } from '@/components/ListFilters'
import { salesChannelsService } from '@/services/sales-channels.service'
import { useAuth } from '@/hooks/useAuth'
import SalesChannelBranchAccounts from './SalesChannelBranchAccounts'
import { salesChannelProtectedBlock, blockedStyle } from '@/lib/actionGuards'

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
  // The side sheet shows either the channel's details or its per-outlet
  // account (COA) mapping, opened from the "Manage COA" row action.
  const [sheetMode, setSheetMode] = useState<'detail' | 'coa'>('detail')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | 'online' | 'offline'>('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: ['sales-channels', debouncedSearch, typeFilter],
    queryFn: () =>
      salesChannelsService
        .list({
          per_page: 1000,
          sort: 'id',
          'filter[search]': debouncedSearch || undefined,
          'filter[sales_order_type]': typeFilter || undefined,
        } as any)
        .then((r) => r.data),
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching
  const items = ((data as any)?.data ?? []).filter(
    (c: any) => !typeFilter || c.sales_order_type === typeFilter,
  )

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
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search sales channels..."
        activeCount={countActive(typeFilter)}
        onClear={() => setTypeFilter('')}
        quick={
          <FilterSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as '' | 'online' | 'offline')}
          >
            <option value="">Semua tipe</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </FilterSelect>
        }
      />
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 56, textAlign: 'center' }}>#</th>
              <th style={thStyle}>Name</th>
              <th style={{ ...thStyle, width: 180 }}>Sales Order Type</th>
              <th style={{ ...thStyle, width: 160 }}>Created</th>
              <th style={{ ...thStyle, width: 200, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5].map((j) => (
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
                  No sales channels yet. Add one to get started.
                </td>
              </tr>
            )}
            {items.map((item: any, idx: number) => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13 }}>
                  {idx + 1}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{canRead ? item.name : "***"}</td>
                <td style={tdStyle}>
                  {!canRead ? '***' : item.sales_order_type ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 10px',
                        borderRadius: 99,
                        fontSize: 12,
                        fontWeight: 600,
                        background: item.sales_order_type === 'online' ? 'var(--info-bg)' : 'var(--accent-light-bg)',
                        color: item.sales_order_type === 'online' ? 'var(--info)' : 'var(--accent)',
                      }}
                    >
                      {item.sales_order_type === 'online' ? <Globe size={12} /> : <Store size={12} />}
                      {item.sales_order_type === 'online' ? 'Online' : 'Offline'}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                  {canRead ? item.created_at
                    ? formatDateShort(item.created_at)
                    : '—' : "***"}
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
                    {/* Per-outlet receivable / fee accounts — online channels only. */}
                    {item.sales_order_type === 'online' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSheetMode('coa')
                          setSelectedItem(item)
                        }}
                        title="Manage COA"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '4px 10px',
                          border: '1px solid var(--accent-light)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--accent-light-bg)',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <BookOpen size={13} />
                        Manage COA
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setSheetMode('detail')
                        setSelectedItem(item)
                      }}
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
                      disabled={!!salesChannelProtectedBlock(item)}
                      title={salesChannelProtectedBlock(item) ?? 'Edit'}
                      onClick={() => {
                        if (salesChannelProtectedBlock(item)) return
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
                        ...(salesChannelProtectedBlock(item) ? blockedStyle : {}),
                      }}>Edit
                    </button>)}
                    {canDelete && (<button
                      type="button"
                      disabled={!!salesChannelProtectedBlock(item)}
                      title={salesChannelProtectedBlock(item) ?? 'Delete'}
                      onClick={() => { if (!salesChannelProtectedBlock(item)) setDeleteTarget(item) }}
                      style={{
                        fontSize: 12,
                        padding: '4px 10px',
                        border: '1px solid var(--destructive)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--destructive)',
                        ...(salesChannelProtectedBlock(item) ? blockedStyle : {}),
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
              width: 'min(760px, 100vw)',
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 20,
                      fontWeight: 500,
                      margin: 0,
                      color: 'var(--foreground)',
                    }}
                  >
                    {sheetMode === 'coa' ? `Manage COA · ${selectedItem.name}` : selectedItem.name}
                  </h2>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      background: selectedItem.sales_order_type === 'online' ? 'var(--info-bg)' : 'var(--accent-light-bg)',
                      color: selectedItem.sales_order_type === 'online' ? 'var(--info)' : 'var(--accent)',
                    }}
                  >
                    {selectedItem.sales_order_type ?? '—'}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
                  ID {selectedItem.id}
                  {selectedItem.created_at ? ` · Dibuat ${formatDateTime(selectedItem.created_at)}` : ''}
                </span>
              </div>
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
              {sheetMode === 'coa' ? (
                // Only online channels carry receivable / fee accounts.
                selectedItem.sales_order_type === 'online' ? (
                  <SalesChannelBranchAccounts
                    salesChannelId={Number(selectedItem.id)}
                    canEdit={canEdit}
                  />
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>
                    Offline channels don't need receivable or fee accounts per outlet.
                  </div>
                )
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '160px 1fr',
                    rowGap: 12,
                    columnGap: 16,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--foreground-muted)' }}>Name</span>
                  <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{selectedItem.name}</span>
                  <span style={{ color: 'var(--foreground-muted)' }}>Sales order type</span>
                  <span style={{ color: 'var(--foreground)', textTransform: 'capitalize' }}>
                    {selectedItem.sales_order_type ?? '—'}
                  </span>
                  <span style={{ color: 'var(--foreground-muted)' }}>Created</span>
                  <span style={{ color: 'var(--foreground)' }}>
                    {selectedItem.created_at ? formatDateTime(selectedItem.created_at) : '—'}
                  </span>
                </div>
              )}
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
