'use client'
import { formatDateTime } from '@/utils/date';
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, X } from 'lucide-react'
import { FilterBar, FilterGroup, FilterField, FilterSelect, FilterInput, DateRange, countActive } from '@/components/ListFilters'
import { auditLogsService } from '@/services/audit-logs.service'
import { branchesService } from '@/services/branches.service'
import { enumsService } from '@/services/enums.service'
import { useAuth } from '@/hooks/useAuth'
import { CustomPagination } from '@/components/ui/CustomPagination'

export default function AuditLogsView() {
  const { hasPermission, isSuperadmin, user } = useAuth()
  const canRead = hasPermission("audit-log.read") || isSuperadmin;
  
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [selectedItem, setSelectedItem] = useState<any | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [referenceTypeFilter, setReferenceTypeFilter] = useState('')
  const [referenceId, setReferenceId] = useState('')
  const [debouncedReferenceId, setDebouncedReferenceId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedReferenceId(referenceId.trim()), 400)
    return () => clearTimeout(t)
  }, [referenceId])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, actionFilter, branchFilter, referenceTypeFilter, debouncedReferenceId, dateFrom, dateTo])

  // Filter lookups: enums (action / reference type) + branches
  const { data: enumsData } = useQuery({
    queryKey: ['enums'],
    queryFn: () => enumsService.getAll().then((r) => r.data),
  })
  const enumMap: Record<string, string[]> = (enumsData as any) ?? {}
  const actionOptions: string[] = enumMap['AuditLogAction'] ?? ['create', 'update', 'delete']
  const referenceTypeOptions: string[] = enumMap['AuditLogReferenceType'] ?? []

  // Superadmin sees all branches, others their assigned branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'by-name'],
    queryFn: () => branchesService.list({ per_page: 200, sort: 'name' } as any).then((r) => r.data),
    enabled: isSuperadmin && canRead,
  })
  const branchOptions: { id: number; name: string }[] = isSuperadmin
    ? (branchesData as any)?.data ?? []
    : (user as any)?.branches ?? []

  const humanize = (v: string) =>
    v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: ['audit-logs', page, perPage, debouncedSearch, actionFilter, branchFilter, referenceTypeFilter, debouncedReferenceId, dateFrom, dateTo],
    queryFn: () =>
      auditLogsService
        .list({
          page,
          per_page: perPage,
          sort: '-created_at',
          include: 'created_by',
          'filter[search]': debouncedSearch || undefined,
          'filter[action]': actionFilter || undefined,
          'filter[branch_id]': branchFilter || undefined,
          'filter[reference_type]': referenceTypeFilter || undefined,
          'filter[reference_id]': debouncedReferenceId || undefined,
          'filter[created_at_gte]': dateFrom ? `${dateFrom} 00:00:00` : undefined,
          'filter[created_at_lte]': dateTo ? `${dateTo} 23:59:59` : undefined,
        } as any)
        .then((r) => r.data),
    enabled: canRead
  })
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching
  
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
      
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search logs..."
        activeCount={countActive(actionFilter, branchFilter, referenceTypeFilter, referenceId, dateFrom, dateTo)}
        onClear={() => {
          setActionFilter('')
          setBranchFilter('')
          setReferenceTypeFilter('')
          setReferenceId('')
          setDateFrom('')
          setDateTo('')
          setPage(1)
        }}
        quick={
          <FilterSelect value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All Actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {humanize(a)}
              </option>
            ))}
          </FilterSelect>
        }
      >
        <FilterGroup title="Reference">
          <FilterField label="Reference type">
            <FilterSelect block value={referenceTypeFilter} onChange={(e) => setReferenceTypeFilter(e.target.value)}>
              <option value="">All References</option>
              {referenceTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Reference ID">
            <FilterInput
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="Ref ID"
              inputMode="numeric"
            />
          </FilterField>
        </FilterGroup>
        <FilterGroup title="Location & Dates">
          <FilterField label="Branch">
            <FilterSelect block value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All Branches</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </FilterSelect>
          </FilterField>
          <FilterField label="Created date">
            <DateRange from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </FilterField>
        </FilterGroup>
      </FilterBar>

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
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
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
                  No audit logs found.
                </td>
              </tr>
            )}
            {items.map((item: any, idx: number) => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                  {(page - 1) * perPage + idx + 1}
                </td>
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
