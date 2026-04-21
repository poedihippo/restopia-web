'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { permissionsService } from '@/services/permissions.service'
import { ShieldCheck, Search } from 'lucide-react'

interface Permission {
  id: number
  name: string
  created_at?: string
}

export default function PermissionsView() {
  const [search, setSearch] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['permissions-all'],
    queryFn: () => permissionsService.list().then((r) => r.data),
  })

  const all: Permission[] = Array.isArray(data)
    ? (data as Permission[])
    : ((data as any)?.data ?? [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter((p) => p.name.toLowerCase().includes(q))
  }, [all, search])

  const groups = useMemo(() => {
    const map: Record<string, Permission[]> = {}
    for (const p of filtered) {
      const key = (p.name.split('.')[0] ?? p.name.split('-')[0] ?? 'general').trim() || 'general'
      if (!map[key]) map[key] = []
      map[key].push(p)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const inputBase: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--foreground)',
    background: 'var(--surface)',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  return (
    <div style={{ padding: '32px 32px 64px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          Permissions
        </h1>
        <p style={{ fontSize: 14, color: 'var(--foreground-muted)', margin: '4px 0 0' }}>
          System-defined capabilities assignable to roles
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 320 }}>
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
            placeholder="Search permissions..."
            style={{
              ...inputBase,
              width: 320,
              padding: '8px 12px 8px 32px',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
          {filtered.length} of {all.length}
        </span>
      </div>

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {isLoading ? (
          <div style={{ padding: 24 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 14,
                  marginBottom: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--border)',
                  width: `${60 + (i % 3) * 10}%`,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        ) : isError ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              fontSize: 14,
              color: 'var(--destructive)',
            }}
          >
            Failed to load permissions.
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: 'var(--foreground-muted)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <ShieldCheck size={32} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14 }}>No permissions match</span>
          </div>
        ) : (
          groups.map(([group, perms]) => (
            <div key={group}>
              <div
                style={{
                  padding: '10px 16px',
                  background: 'var(--background)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {group}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 0,
                }}
              >
                {perms.map((perm) => (
                  <div
                    key={perm.id}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border)',
                      borderRight: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 99,
                        background: 'var(--accent-light-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ShieldCheck size={13} color="var(--accent-light)" />
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontFamily: 'monospace',
                        color: 'var(--foreground)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {perm.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
