'use client'
import { formatDateShort, formatDateTime } from '@/utils/date';

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, X, Search, Download } from 'lucide-react'
import { taxesService } from '@/services/taxes.service'
import { reportsService } from '@/services/reports.service'
import { downloadFileFromResponse } from '@/utils/file'
import { useAuth } from '@/hooks/useAuth'

export default function TaxesView() {
  const qc = useQueryClient()
  const { hasPermission } = useAuth()
  const canRead = hasPermission("tax.read");
  const canCreate = hasPermission('tax.create')
  const canEdit = hasPermission('tax.update')
  const canDelete = hasPermission('tax.delete')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [rate, setRate] = useState<number>(0)
  const [inclusive, setInclusive] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [description, setDescription] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading } = useQuery({
    queryKey: ['taxes', debouncedSearch],
    queryFn: () =>
      taxesService
        .list({
          per_page: 1000,
          sort: 'id',
          'filter[search]': debouncedSearch || undefined,
        } as any)
        .then((r) => r.data),
  })
  const items = (data as any)?.data ?? []

  const resetForm = () => {
    setEditing(null)
    setCode('')
    setName('')
    setRate(0)
    setInclusive(false)
    setIsActive(true)
    setDescription('')
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => {
      const payload = { code, name, rate: Number(rate), inclusive, is_active: isActive, description }
      return editing
        ? taxesService.update(editing.id, payload)
        : taxesService.create(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taxes'] })
      toast.success(editing ? 'Updated' : 'Created')
      setShowForm(false)
      resetForm()
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
    mutationFn: (id: number) => taxesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['taxes'] })
      toast.success('Deleted')
      setDeleteTarget(null)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Error'),
  })

  const { mutate: exportExcel, isPending: isExporting } = useMutation({
    mutationFn: () => reportsService.exportTaxes(),
    onSuccess: (res) => {
      downloadFileFromResponse(res, `taxes.xlsx`)
    },
    onError: () => {
      toast.error('Gagal mengekspor data.')
    }
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
            Taxes
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            Manage tax rates and types used in sales and purchases.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => exportExcel()} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 20px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600, cursor: isExporting ? 'not-allowed' : 'pointer', opacity: isExporting ? 0.6 : 1 }}>
            <Download size={14} /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </button>
          {canCreate && (<button
            type="button"
            onClick={() => {
              resetForm()
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
            }}>+ Add Tax
          </button>)}
        </div>
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
          placeholder="Search taxes..."
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
          maxWidth: 900,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Code</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Rate</th>
              <th style={thStyle}>Inclusive</th>
              <th style={thStyle}>Status</th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5, 6, 7].map((j) => (
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
                  colSpan={7}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: 40,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No taxes defined. Add one to get started.
                </td>
              </tr>
            )}
            {items.map((item: any, idx: number) => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                  {idx + 1}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{canRead ? item.code : "***"}</td>
                <td style={tdStyle}>{canRead ? item.name : "***"}</td>
                <td style={tdStyle}>{canRead ? `${item.rate}%` : "***"}</td>
                <td style={tdStyle}>{canRead ? (item.inclusive ? 'Yes' : 'No') : "***"}</td>
                <td style={tdStyle}>
                  {canRead ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '3px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: item.is_active ? 'var(--success-bg)' : 'var(--foreground-muted)',
                        color: item.is_active ? 'var(--success)' : 'white',
                      }}
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  ) : "***"}
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
                        setCode(item.code)
                        setName(item.name)
                        setRate(item.rate)
                        setInclusive(item.inclusive)
                        setIsActive(item.is_active)
                        setDescription(item.description || '')
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
              width: 440,
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
                {editing ? 'Edit Tax' : 'New Tax'}
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
            <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                  Code *
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. PPN-11"
                  style={{
                    width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                  Name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PPN"
                  style={{
                    width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                  Rate (%) *
                </label>
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  placeholder="e.g. 11"
                  min="0"
                  style={{
                    width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={inclusive}
                    onChange={(e) => setInclusive(e.target.checked)}
                  />
                  <span style={{ fontSize: 14, color: 'var(--foreground)' }}>Inclusive Tax</span>
                </label>
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 4, marginLeft: 21 }}>
                  If checked, the tax is included in the product price.
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span style={{ fontSize: 14, color: 'var(--foreground)' }}>Active</span>
                </label>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--foreground-muted)', display: 'block', marginBottom: 6 }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: '100%', minHeight: 80, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface-raised)', boxSizing: 'border-box', fontFamily: 'var(--font-sans)', resize: 'vertical'
                  }}
                />
              </div>
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
                  if (!code.trim() || !name.trim()) {
                    toast.error('Code and Name are required')
                    return
                  }
                  if (rate < 0) {
                    toast.error('Rate must be greater than or equal to 0')
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
                Tax Detail
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
                { label: 'Code', value: selectedItem.code },
                { label: 'Name', value: selectedItem.name },
                { label: 'Rate', value: `${selectedItem.rate}%` },
                { label: 'Inclusive', value: selectedItem.inclusive ? 'Yes' : 'No' },
                { label: 'Status', value: selectedItem.is_active ? 'Active' : 'Inactive' },
                { label: 'Description', value: selectedItem.description || '—' },
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
              Delete Tax
            </h3>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginBottom: 24 }}>
              Delete <strong>{deleteTarget.code}</strong>? This cannot be undone.
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
