'use client'
import { formatDateTime } from '@/utils/date';
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { operationsService } from '@/services/operations.service';
import { useAuth } from '@/hooks/useAuth';
import OperationSheet from './OperationSheet';
import { Plus, Search, ChevronLeft, ChevronRight, Pencil, Trash2, Eye, X, Settings2 } from 'lucide-react';

export default function OperationsView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canOpen = true;
  const canRollover = true;
  const [sheetMode, setSheetMode] = useState<"open" | "rollover">("open");
  
  

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editData, setEditData] = useState<any | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['operations', page, debouncedSearch],
    queryFn: () =>
      operationsService.list({
        page,
        per_page: 15,
        sort: '-id',
        'filter[search]': debouncedSearch || undefined,
      } as any).then((r) => r.data),
  });

  const items: any[] = (data as any)?.data ?? [];
  const meta = (data as any)?.meta;


  const lastPage = meta?.last_page ?? meta?.total_pages ?? 1;

  const thStyle: React.CSSProperties = { padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
  const inputBase: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--foreground)', background: 'var(--surface)', outline: 'none', fontFamily: 'var(--font-sans)' };
  const actionBtnStyle: React.CSSProperties = { padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--foreground-muted)', display: 'flex' };

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Operations</h1>
          <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>Manage daily operations</p>
        </div>
        
        <div style={{ display: 'flex', gap: 10 }}>
          {canOpen && (
            <button onClick={() => { setSheetMode('open'); setSheetOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={15} /> Open Operation
            </button>
          )}
          {canRollover && (
            <button onClick={() => { setSheetMode('rollover'); setSheetOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={15} /> Rollover
            </button>
          )}
        </div>

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
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Opened At</th>
              <th style={thStyle}>Closed At</th>
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
              items.map((item) => (
                <tr key={item.id} style={{ transition: 'background 120ms' }} onMouseEnter={(ev) => (ev.currentTarget.style.background = 'var(--background)')} onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}>
                  <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>#{item.id}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.date || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.opened_at || '—'}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 13, color: 'var(--foreground)' }}>{item.closed_at || '—'}</span></td>
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

      {meta && lastPage > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>Page {page} of {lastPage}</span>
          <button onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page === lastPage} style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: page === lastPage ? 'var(--foreground-subtle)' : 'var(--foreground)', cursor: page === lastPage ? 'not-allowed' : 'pointer', fontSize: 13 }}><ChevronRight size={15} /></button>
        </div>
      )}


      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelectedItem(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.18)' }} />
          <div style={{ position: 'relative', zIndex: 50, width: 420, height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, margin: 0, color: 'var(--foreground)' }}>Operation Detail</h2>
              <button onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><X size={18} color="var(--foreground-muted)" /></button>
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'ID', value: selectedItem.id },
                { label: 'Date', value: selectedItem.date },
                { label: 'Opened At', value: selectedItem.opened_at },
                { label: 'Closed At', value: selectedItem.closed_at },
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

      <OperationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} mode={sheetMode} />
    </div>
  );
}