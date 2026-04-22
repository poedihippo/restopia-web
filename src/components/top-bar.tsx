'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  User,
  Building2,
  Check,
  X,
  RefreshCw,
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
  const { user, logout, refreshUser } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) {
        setBranchMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  const breadcrumbs = getBreadcrumbs(router.pathname);
  const branchName = user?.branch?.name ?? '—';
  const userInitial = user?.name?.charAt(0)?.toUpperCase() ?? 'U';
  const availableBranches = user?.branches ?? [];

  const onSelectBranch = async (branchId: number) => {
    try {
      await authService.changeActiveBranch({ branch_id: branchId });
      window.location.reload();
    } catch {
      setBranchMenuOpen(false);
    }
  };

  const onRefreshBranches = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

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
        <div style={{ position: 'relative' }} ref={branchRef}>
          <button
            type="button"
            onClick={() => setBranchMenuOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              background: branchMenuOpen ? 'var(--accent-light-bg)' : 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--foreground-muted)',
              fontWeight: 500,
            }}
          >
            <Building2 size={13} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
            <span>{branchName}</span>
            <ChevronsUpDown size={11} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
          </button>

          {branchMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: 240,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 50,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
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
                  Switch Branch
                </span>
                <button
                  type="button"
                  onClick={onRefreshBranches}
                  disabled={refreshing}
                  title="Refresh branches"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: refreshing ? 'not-allowed' : 'pointer',
                    padding: 2,
                    display: 'flex',
                    color: 'var(--foreground-muted)',
                  }}
                >
                  <RefreshCw
                    size={12}
                    style={{
                      animation: refreshing ? 'spin 1s linear infinite' : undefined,
                    }}
                  />
                </button>
              </div>
              {availableBranches.length === 0 && (
                <div
                  style={{
                    padding: '14px',
                    fontSize: 12,
                    color: 'var(--foreground-muted)',
                    textAlign: 'center',
                  }}
                >
                  No branches assigned
                </div>
              )}
              {availableBranches.map((branch) => {
                const isActive = branch.id === user?.branch?.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => onSelectBranch(branch.id!)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                      color: isActive ? 'var(--accent)' : 'var(--foreground)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {isActive ? (
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: 'var(--accent)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div style={{ width: 6, height: 6, flexShrink: 0 }} />
                    )}
                    <span style={{ flex: 1 }}>{branch.name}</span>
                    {isActive && (
                      <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto' }}>
                        Active
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: 'var(--border)',
          }}
        />

        {/* Profile detail panel */}
        {profileOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 60,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <div
              onClick={() => setProfileOpen(false)}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.18)',
              }}
            />
            <div
              style={{
                position: 'relative',
                zIndex: 70,
                width: 380,
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
                  My Profile
                </h2>
                <button
                  onClick={() => setProfileOpen(false)}
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
                  { label: 'Name', value: user?.name },
                  { label: 'Email', value: user?.email },
                  { label: 'Type', value: user?.type, isType: true },
                  { label: 'Branch', value: user?.branch?.name },
                  { label: 'Phone', value: (user as any)?.phone },
                  { label: 'NIK', value: user?.nik },
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
                    {f.isType && f.value ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignSelf: 'flex-start',
                          padding: '2px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 500,
                          background:
                            f.value === 'superadmin'
                              ? 'var(--warning-bg)'
                              : 'var(--info-bg)',
                          color:
                            f.value === 'superadmin'
                              ? 'var(--warning)'
                              : 'var(--info)',
                        }}
                      >
                        {f.value}
                      </span>
                    ) : (
                      <span style={{ fontSize: 14, color: 'var(--foreground)' }}>
                        {f.value ?? '—'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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

              {/* Profile */}
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  setProfileOpen(true);
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
                  color: 'var(--foreground)',
                  fontWeight: 500,
                  textAlign: 'left',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--background)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'none';
                }}
              >
                <User size={14} style={{ flexShrink: 0 }} />
                My Profile
              </button>

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
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
}
