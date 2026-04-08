'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import customerService from '@/services/customer.service';
import CustomerSheet from './CustomerSheet';

export default function CustomersView() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, searchDebounced],
    queryFn: () => customerService.list({
      page,
      per_page: 15,
      sort: 'name',
      ...(searchDebounced ? { 'filter[search]': searchDebounced } : {}),
    }).then(r => r.data),
  });

  const items = (data as any)?.data ?? [];
  const meta = (data as any)?.meta;

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (id: number) => customerService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? 'Error'),
  });

  const thStyle: React.CSSProperties = {
    padding: '10px 16px', textAlign: 'left', fontSize: 12,
    fontWeight: 600, color: 'var(--foreground-muted)',
    borderBottom: '1px solid var(--border)',
  };
  const tdStyle: React.CSSProperties = {
    padding: '12px 16px', fontSize: 14,
    color: 'var(--foreground)', borderBottom: '1px solid var(--border)',
  };

  return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Customers</h1>
          <p style={{ color: 'var(--foreground-muted)', fontSize: 14, marginTop: 4 }}>Manage your customer records</p>
        </div>
        <button
          onClick={() => { setEditing(null); setSheetOpen(true); }}
          style={{ height: 40, padding: '0 20px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >+ New Customer</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or phone..."
          style={{ height: 38, width: 320, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 12px', fontSize: 14, color: 'var(--foreground)', background: 'var(--surface)' }}
        />
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Phone</th>
              <th style={thStyle}>Created At</th>
              <th style={{ ...thStyle, width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} style={tdStyle}><div style={{ height: 16, background: 'var(--border)', borderRadius: 4, opacity: 0.5 }} /></td>
                ))}
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={4} style={{ ...tdStyle, textAlign: 'center', padding: 48, color: 'var(--foreground-muted)' }}>No customers found</td></tr>
            )}
            {items.map((item: any) => (
              <tr key={item.id}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.name}</td>
                <td style={tdStyle}>{item.phone ?? '—'}</td>
                <td style={{ ...tdStyle, color: 'var(--foreground-muted)' }}>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setEditing(item); setSheetOpen(true); }}
                      style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--foreground)' }}
                    >Edit</button>
                    <button
                      onClick={() => setDeleteTarget(item)}
                      style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--destructive)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer', color: 'var(--destructive)' }}
                    >Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && (meta.last_page ?? meta.total_pages ?? 1) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--foreground-muted)' }}>{meta.total} customers · Page {page} of {meta.last_page ?? meta.total_pages ?? 1}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ height: 32, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? 'var(--foreground-subtle)' : 'var(--foreground)', fontSize: 13 }}>← Prev</button>
            <button onClick={() => setPage(p => Math.min(meta.last_page ?? meta.total_pages ?? 1, p + 1))} disabled={page === (meta.last_page ?? meta.total_pages ?? 1)} style={{ height: 32, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', cursor: page === (meta.last_page ?? meta.total_pages ?? 1) ? 'not-allowed' : 'pointer', color: page === (meta.last_page ?? meta.total_pages ?? 1) ? 'var(--foreground-subtle)' : 'var(--foreground)', fontSize: 13 }}>Next →</button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-xl)', padding: 32, width: 360, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 8, color: 'var(--foreground)' }}>Delete Customer</h3>
            <p style={{ fontSize: 14, color: 'var(--foreground-muted)', marginBottom: 24 }}>Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, height: 40, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', cursor: 'pointer', fontSize: 14 }}>Cancel</button>
              <button onClick={() => doDelete(deleteTarget.id)} disabled={deleting} style={{ flex: 1, height: 40, border: 'none', borderRadius: 'var(--radius-md)', background: 'var(--destructive)', color: 'white', cursor: deleting ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600 }}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <CustomerSheet open={sheetOpen} onClose={() => { setSheetOpen(false); setEditing(null); }} editing={editing} />
    </div>
  );
}
