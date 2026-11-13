'use client'
import { formatDateTime } from '@/utils/date';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { shiftRulesService } from '@/services/shift-rules.service';
import { branchesService } from '@/services/branches.service';
import { useAuth } from '@/hooks/useAuth';
import ShiftRuleSheet from './ShiftRuleSheet';
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Eye, X, Settings2 } from 'lucide-react';
import { FilterBar, FilterSelect, countActive } from '@/components/ListFilters';
import { toastMutationApiError } from '@/utils/apiError';
import { CustomPagination } from '@/components/ui/CustomPagination'
import { useDeepLinkId } from '@/views/Operations/shared'

export default function ShiftRulesView() {
  const qc = useQueryClient();
  const { hasPermission, isSuperadmin, user } = useAuth();
  const canRead = hasPermission('shift-rule.read');
  const canCreate = hasPermission('shift-rule.create');
  const canEdit = hasPermission('shift-rule.update');
  const canDelete = hasPermission('shift-rule.delete');

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editData, setEditData] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [deepId, clearDeepId] = useDeepLinkId();
  // Arriving from a "Go to shift rule" link opens that rule's detail.
  const { data: deepData } = useQuery({
    queryKey: ['shiftrules', 'detail', deepId],
    queryFn: () => shiftRulesService.findById(deepId!, { include: 'created_by,updated_by' }).then((r) => r.data),
    enabled: !!deepId,
  });
  useEffect(() => {
    const rule = (deepData as any)?.data;
    if (rule) setSelectedItem(rule);
  }, [deepData]);
  const closeDetail = () => {
    setSelectedItem(null);
    clearDeepId();
  };
  const [branchFilter, setBranchFilter] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, branchFilter]);

  // Filter lookup: branches (superadmin sees all, others their assigned branches — same as the sheet)
  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'by-name'],
    queryFn: () => branchesService.list({ per_page: 200, sort: 'name' } as any).then((r) => r.data),
    enabled: isSuperadmin,
  });
  const branchOptions: any[] = isSuperadmin ? (branchesData as any)?.data ?? [] : user?.branches ?? [];


  const { data, isLoading: listFirstLoad, isFetching: listFetching, isError } = useQuery({
    queryKey: ['shiftrules', page, perPage, debouncedSearch, branchFilter],
    queryFn: () =>
      shiftRulesService.list({
        page,
        per_page: perPage,
        sort: '-id',
        include: 'created_by,updated_by',
        'filter[search]': debouncedSearch || undefined,
        'filter[branch_id]': branchFilter || undefined,
      } as any).then((r) => r.data),
  });
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching

  const items: any[] = (data as any)?.data ?? [];
  const meta = (data as any)?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => shiftRulesService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shiftrules'] });
      toast.success('ShiftRule deleted');
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete ShiftRule'),
  });

  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1;

  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
  const actionBtnStyle: React.CSSProperties = { padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' };

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Shift Rules</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Manage shift rules for branches</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditData(null); setSheetOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={15} /> New ShiftRule
          </button>
        )}
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search..."
        activeCount={countActive(branchFilter)}
        onClear={() => { setBranchFilter(''); setPage(1); }}
        quick={
          <FilterSelect value={branchFilter} onChange={(ev) => { setBranchFilter(ev.target.value); setPage(1); }}>
            <option value="">All Branches</option>
            {branchOptions.map((o: any) => (
              <option key={o.id} value={String(o.id)}>{o.name}</option>
            ))}
          </FilterSelect>
        }
      />

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: 'center' }}>No.</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Start Time</th>
              <th style={thStyle}>End Time</th>
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
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.name || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.start_time || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.end_time || '—'}</span></td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <button onClick={() => setSelectedItem(item)} style={actionBtnStyle} title="View"><Eye size={14} /></button>
                      {canEdit && <button onClick={() => { setEditData(item); setSheetOpen(true); }} style={actionBtnStyle} title="Edit"><Pencil size={14} /></button>}
                      {canDelete && <button onClick={() => setDeleteConfirmId(item.id)} style={{ ...actionBtnStyle, color: 'var(--destructive)' }} title="Delete"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />

      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 380, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete ShiftRule</h3>
            <p style={{ fontSize: 13, color: 'var(--foreground-muted)', margin: '0 0 24px' }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '7px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} style={{ padding: '7px 16px', background: 'var(--destructive)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: deleteMutation.isPending ? 0.7 : 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={closeDetail} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 50, width: 420, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>ShiftRule Detail</h2>
              <button onClick={closeDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Name', value: selectedItem.name },
                { label: 'Start Time', value: selectedItem.start_time },
                { label: 'End Time', value: selectedItem.end_time },
                { label: 'Created', value: selectedItem.created_at ? `${formatDateTime(selectedItem.created_at)} · ${selectedItem.created_by?.name ?? '—'}` : null },
                { label: 'Last Updated', value: selectedItem.updated_at ? `${formatDateTime(selectedItem.updated_at)} · ${selectedItem.updated_by?.name ?? '—'}` : null },
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

      <ShiftRuleSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditData(null); }} editData={editData} />
    </div>
  );
}