'use client'
import { formatDateTime } from '@/utils/date';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { shiftsService } from '@/services/shifts.service';
import { useAuth } from '@/hooks/useAuth';
import ShiftSheet from './ShiftSheet';
import { Plus, Search, ChevronLeft, ChevronRight, Pencil, Trash2, Eye, X, Settings2 } from 'lucide-react';
import { toastMutationApiError } from '@/utils/apiError';

export default function ShiftsView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canCreate = true;
  const canEdit = true;
  const canDelete = true;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editData, setEditData] = useState<any | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shifts', page, debouncedSearch],
    queryFn: () =>
      shiftsService.list({
        page,
        per_page: 15,
        sort: '-id',
        'filter[search]': debouncedSearch || undefined,
      } as any).then((r) => r.data),
  });

  const items: any[] = (data as any)?.data ?? [];
  const meta = (data as any)?.meta;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => shiftsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      toast.success('Shift deleted');
      setDeleteConfirmId(null);
    },
    onError: (err: any) => toastMutationApiError(err, 'Failed to delete Shift'),
  });

  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1;

  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
  const inputBase: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--foreground)', background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-sans)' };
  const actionBtnStyle: React.CSSProperties = { padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' };

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Shifts</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Manage daily shifts</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditData(null); setSheetOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={15} /> New Shift
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 300, width: '100%' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--foreground-muted)', pointerEvents: 'none' }} />
          <input value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder="Search..." style={{ ...inputBase, width: '100%', padding: '8px 12px 8px 32px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Started At</th>
              <th style={thStyle}>Ended At</th>
              <th style={{ ...thStyle, width: 80 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px' }}>Loading...</td></tr>
            ) : isError ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--destructive)' }}>Failed to load.</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: '48px 16px', color: 'var(--foreground-muted)' }}>No data found.</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} style={{ transition: 'background 120ms' }} onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--background)')} onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>#{item.id}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.started_at || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.ended_at || '—'}</span></td>
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

      {meta && lastPage > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Page {page} of {lastPage}</span>
          <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page === lastPage} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: page === lastPage ? 'var(--foreground-subtle)' : 'var(--foreground)', cursor: page === lastPage ? 'not-allowed' : 'pointer', fontSize: 13 }}><ChevronRight size={15} /></button>
        </div>
      )}

      {deleteConfirmId !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setDeleteConfirmId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.22)' }} />
          <div style={{ position: 'relative', zIndex: 70, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 28px 24px', width: 380, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, margin: '0 0 8px', color: 'var(--foreground)' }}>Delete Shift</h3>
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

      <ShiftSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditData(null); }} editData={editData} />
    </div>
  );
}