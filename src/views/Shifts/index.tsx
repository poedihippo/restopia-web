'use client'
import { formatDateTime } from '@/utils/date';
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { shiftsService } from '@/services/shifts.service';
import { branchesService } from '@/services/branches.service';
import { operationsService } from '@/services/operations.service';
import { shiftRulesService } from '@/services/shift-rules.service';
import { useAuth } from '@/hooks/useAuth';
import { Eye, X } from 'lucide-react';
import { FilterBar, FilterSelect, countActive } from '@/components/ListFilters';
import { CustomPagination } from '@/components/ui/CustomPagination'

export default function ShiftsView() {
  const { hasPermission, isSuperadmin, user } = useAuth();
  const canRead = hasPermission('shift.read');
  // Read-only: the API exposes only GET for this resource (no create/update/delete).

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [branchFilter, setBranchFilter] = useState('');
  const [operationFilter, setOperationFilter] = useState('');
  const [shiftRuleFilter, setShiftRuleFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, branchFilter, operationFilter, shiftRuleFilter]);

  // Filter lookup: branches (superadmin sees all, others their assigned branches — same as the sheet)
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'by-name'],
    queryFn: () => branchesService.list({ per_page: 200, sort: 'name' } as any).then((r) => r.data),
    enabled: isSuperadmin,
  });
  const branchOptions: any[] = isSuperadmin ? (branchesData as any)?.data ?? [] : user?.branches ?? [];
  const canReadOperations = hasPermission('operation.read');
  const { data: operationsData } = useQuery({
    queryKey: ['operations-all'],
    queryFn: () => operationsService.list({ per_page: 100, sort: '-id' } as any).then((r) => r.data),
    enabled: canReadOperations,
  });
  const operationOptions: any[] = (operationsData as any)?.data ?? [];
  const canReadShiftRules = hasPermission('shift-rule.read');
  const { data: shiftRulesData } = useQuery({
    queryKey: ['shift-rules-all'],
    queryFn: () => shiftRulesService.list({ per_page: 100, sort: '-id' } as any).then((r) => r.data),
    enabled: canReadShiftRules,
  });
  const shiftRuleOptions: any[] = (shiftRulesData as any)?.data ?? [];


  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['shifts', page, perPage, debouncedSearch, branchFilter, operationFilter, shiftRuleFilter],
    queryFn: () =>
      shiftsService.list({
        page,
        per_page: perPage,
        sort: '-id',
        'filter[search]': debouncedSearch || undefined,
        'filter[branch_id]': branchFilter || undefined,
        'filter[operation_id]': operationFilter || undefined,
        'filter[shift_rule_id]': shiftRuleFilter || undefined,
      } as any).then((r) => r.data),
  });
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: any[] = (data as any)?.data ?? [];
  const meta = (data as any)?.meta;

  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1;

  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
  const actionBtnStyle: React.CSSProperties = { padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' };

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Shifts</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Manage daily shifts</p>
        </div>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search..."
        activeCount={countActive(branchFilter, operationFilter, shiftRuleFilter)}
        onClear={() => { setBranchFilter(''); setOperationFilter(''); setShiftRuleFilter(''); setPage(1); }}
        quick={
          <>
            <FilterSelect value={branchFilter} onChange={(ev) => { setBranchFilter(ev.target.value); setPage(1); }}>
              <option value="">All Branches</option>
              {branchOptions.map((o: any) => (
                <option key={o.id} value={String(o.id)}>{o.name}</option>
              ))}
            </FilterSelect>
            {canReadOperations && (
              <FilterSelect value={operationFilter} onChange={(ev) => { setOperationFilter(ev.target.value); setPage(1); }}>
                <option value="">All Operations</option>
                {operationOptions.map((o: any) => (
                  <option key={o.id} value={String(o.id)}>{`#${o.id}${o.date ? ' · ' + o.date : ''}`}</option>
                ))}
              </FilterSelect>
            )}
            {canReadShiftRules && (
              <FilterSelect value={shiftRuleFilter} onChange={(ev) => { setShiftRuleFilter(ev.target.value); setPage(1); }}>
                <option value="">All Shift Rules</option>
                {shiftRuleOptions.map((o: any) => (
                  <option key={o.id} value={String(o.id)}>{o.name ?? `#${o.id}`}</option>
                ))}
              </FilterSelect>
            )}
          </>
        }
      />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Started At</th>
              <th style={thStyle}>Ended At</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>Loading...</td></tr>
            ) : isError ? (
              <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--destructive)' }}>Failed to load.</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--foreground-muted)' }}>No data found.</td></tr>
            ) : (
              items.map((item, idx) => (
                <tr key={item.id} style={{ transition: 'background 120ms' }} onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--background)')} onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--foreground-muted)', fontSize: 13, width: 50 }}>
                    {(page - 1) * perPage + idx + 1}
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>#{item.id}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.started_at || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.ended_at || '—'}</span></td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => setSelectedItem(item)} style={actionBtnStyle} title="View"><Eye size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelectedItem(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 50, width: 420, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>Shift Detail</h2>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'ID', value: selectedItem.id },
                { label: 'Started At', value: selectedItem.started_at },
                { label: 'Ended At', value: selectedItem.ended_at },
              ].map((f) => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{f.label}</span>
                  <span style={{ fontSize: 14, color: 'var(--foreground)' }}>{f.value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}