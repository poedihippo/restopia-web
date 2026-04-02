'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  User,
  Building2,
  Check,
} from 'lucide-react';

function getBreadcrumbs(pathname: string): Array<{ label: string; href: string }> {
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/');

    let label: string;
    if (/^\[.+\]$/.test(segment) || /^\d+$/.test(segment)) {
      label = 'Detail';
    } else {
      label = segment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return { label, href };
  });

  if (pathname !== '/dashboard') {
    return [{ label: 'Dashboard', href: '/dashboard' }, ...crumbs];
  }

  return crumbs;
}

const BRANCH_LABEL_MAP: Record<string, string> = {};

export default function TopBar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const breadcrumbs = getBreadcrumbs(router.pathname);
  const branchName = user?.branch?.name ?? '—';
  const userInitial = user?.name?.charAt(0)?.toUpperCase() ?? 'U';

  return (
    <header
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--topbar-bg)',
        borderBottom: '1px solid var(--topbar-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* LEFT — Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.href}>
              {!isLast ? (
                <>
                  <Link
                    href={crumb.href}
                    style={{
                      fontSize: 13,
                      color: 'var(--foreground-muted)',
                      textDecoration: 'none',
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--foreground)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--foreground-muted)';
                    }}
                  >
                    {crumb.label}
                  </Link>
                  <ChevronRight size={12} style={{ color: 'var(--foreground-subtle)', flexShrink: 0 }} />
                </>
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--foreground)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* RIGHT — Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Branch pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            cursor: 'default',
            fontSize: 12,
            color: 'var(--foreground-muted)',
            fontWeight: 500,
          }}
        >
          <Building2 size={13} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
          <span>{branchName}</span>
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: 'var(--border)',
          }}
        />

        {/* User menu */}
        <div style={{ position: 'relative' }} ref={ref}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 8px',
              background: userMenuOpen ? 'var(--accent-light-bg)' : 'transparent',
              border: `1px solid ${userMenuOpen ? 'var(--border)' : 'transparent'}`,
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              transition: 'background 150ms ease, border-color 150ms ease',
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--accent)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {userInitial}
            </div>

            {/* Name */}
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--foreground)',
                whiteSpace: 'nowrap',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.name ?? '—'}
            </span>

            <ChevronsUpDown size={13} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                minWidth: 200,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-md)',
                overflow: 'hidden',
                zIndex: 50,
              }}
            >
              {/* User info header */}
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    marginBottom: 2,
                  }}
                >
                  {user?.name ?? '—'}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--foreground-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user?.email ?? ''}
                </div>
              </div>

              {/* Logout */}
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '9px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: 'var(--destructive)',
                  fontWeight: 500,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--destructive-bg)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'none';
                }}
              >
                <LogOut size={14} style={{ flexShrink: 0 }} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
