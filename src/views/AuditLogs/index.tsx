'use client'
import { formatDateTime } from '@/utils/date';
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Eye, X } from 'lucide-react'
import { auditLogsService } from '@/services/audit-logs.service'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'

export default function AuditLogsView() {
  const { hasPermission, isSuperadmin } = useAuth()
  const canRead = hasPermission("audit-log.read") || isSuperadmin;
  
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(1000)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, actionFilter])

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, perPage, debouncedSearch, actionFilter],
    queryFn: () =>
      auditLogsService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'created_by',
          'filter[search]': debouncedSearch || undefined,
          'filter[action]': actionFilter || undefined,
        } as any)
        .then((r) => r.data),
    enabled: canRead
  })
  
  const items = (data as any)?.data ?? []
  const meta = (data as any)?.meta

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
            Audit Logs
          </h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>
            View system audit logs and activities
          </p>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 280, flex: 1 }}>
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
            placeholder="Search logs..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              color: 'var(--foreground)',
              background: 'var(--surface)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          style={{
            height: 35,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '0 12px',
            fontSize: 13,
            color: 'var(--foreground)',
            background: 'var(--surface)',
            outline: 'none',
          }}
        >
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
      </div>

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
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Reference</th>
              <th style={thStyle}>Ref ID</th>
              <th style={thStyle}>User</th>
              <th style={{ ...thStyle, width: 80 }}>Actions</th>
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
                  colSpan={6}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    padding: 40,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  No audit logs found.
                </td>
              </tr>
            )}
            {items.map((item: any) => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>
                  {item.created_at ? formatDateTime(item.created_at) : '—'}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: 12,
                    background: item.action === 'create' ? 'var(--success-light)' : item.action === 'update' ? 'var(--warning-light)' : item.action === 'delete' ? 'var(--destructive-light)' : 'var(--border)',
                    color: item.action === 'create' ? 'var(--success)' : item.action === 'update' ? 'var(--warning)' : item.action === 'delete' ? 'var(--destructive)' : 'var(--foreground)',
                  }}>
                    {item.action?.toUpperCase() || '—'}
                  </span>
                </td>
                <td style={tdStyle}>{item.reference_type || '—'}</td>
                <td style={tdStyle}>{item.reference_id || '—'}</td>
                <td style={tdStyle}>{item.created_by?.name || '—'}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      title="View Details"
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
                      <Eye size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

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
              width: 500,
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
                Audit Log Detail
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
                { label: 'Date', value: selectedItem.created_at ? formatDateTime(selectedItem.created_at) : '—' },
                { label: 'Action', value: selectedItem.action },
                { label: 'Reference Type', value: selectedItem.reference_type },
                { label: 'Reference ID', value: selectedItem.reference_id },
                { label: 'User', value: selectedItem.created_by?.name },
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

              {selectedItem.old_data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Old Data</span>
                  <pre style={{ fontSize: 12, background: 'var(--surface-muted)', padding: 12, borderRadius: 6, overflowX: 'auto', border: '1px solid var(--border)' }}>
                    {JSON.stringify(selectedItem.old_data, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedItem.new_data && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>New Data</span>
                  <pre style={{ fontSize: 12, background: 'var(--surface-muted)', padding: 12, borderRadius: 6, overflowX: 'auto', border: '1px solid var(--border)' }}>
                    {JSON.stringify(selectedItem.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
