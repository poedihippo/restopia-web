'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
import { branchesService } from '@/services/branches.service';
import { cn } from '@/lib/utils';
import MenuSearch from '@/components/menu-search';
import TourHelpButton from '@/components/tour/TourHelpButton';
import { NAV_GROUPS } from '@/components/app-sidebar';
import { getBreadcrumbs, shortenBreadcrumbs } from '@/lib/breadcrumbs';
import {
  ChevronRight,
  ChevronsUpDown,
  Menu,
  LogOut,
  User,
  Building2,
  Check,
  RefreshCw,
} from 'lucide-react';

const BRANCH_LABEL_MAP: Record<string, string> = {};

type TopBarProps = {
  // Phones only: opens the off-canvas sidebar.
  onMenuClick?: () => void;
};

export default function TopBar({ onMenuClick }: TopBarProps = {}) {
  const router = useRouter();
  const { user, logout, refreshUser, isSuperadmin } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const branchRef = useRef<HTMLDivElement>(null);

  const { data: branchesData } = useQuery({
    queryKey: ['branches-all', 'with-company'],
    queryFn: () =>
      branchesService
        .list({ per_page: 1000, sort: 'name', include: 'company' } as any)
        .then((r) => r.data),
    enabled: isSuperadmin,
  });
  const allBranches = (branchesData as any)?.data ?? [];

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

  // Short trail: the menu page and the page you are on ("Invoices › Create").
  // Dashboard, sidebar groups and folders (crumbs without a page) are dropped;
  // the sidebar already shows where a page lives.
  const breadcrumbs = shortenBreadcrumbs(getBreadcrumbs(router.pathname, router.query, NAV_GROUPS));
  const branchName = user?.branch?.name ?? '—';
  const userInitial = user?.name?.charAt(0)?.toUpperCase() ?? 'U';
  const availableBranches = isSuperadmin
    ? allBranches
    : user?.branches ?? [];

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
      className="topbar"
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
        // The header is its own stacking context, so its menus can only sit
        // above page content (dropdowns, sheets, popovers) if the header does.
        zIndex: branchMenuOpen || userMenuOpen ? 1200 : 10,
      }}
    >
      <button type="button" className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={18} />
      </button>

      {/* LEFT — Breadcrumb */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <React.Fragment key={`${index}-${crumb.label}`}>
              {!isLast && !crumb.href ? (
                <>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--foreground-muted)',
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {crumb.label}
                  </span>
                  <ChevronRight size={12} style={{ color: 'var(--foreground-subtle)', flexShrink: 0 }} />
                </>
              ) : !isLast && crumb.href ? (
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

        {/* Menu search (Ctrl/⌘+K) */}
        <MenuSearch />

        {/* Help: product tours + FAQ */}
        <TourHelpButton />

        {/* Branch pill */}
        <div style={{ position: 'relative' }} ref={branchRef}>
          <button
            type="button"
            onClick={() => setBranchMenuOpen((v) => !v)}
            className="branch-pill"
            data-tour="branch"
            data-open={branchMenuOpen}
            title="Active branch — click to switch"
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
            <span className="branch-pill-icon">
              <Building2 size={13} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
              <span className="branch-pill-dot" />
            </span>
            <div
              className="branch-pill-text"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 0,
                lineHeight: 1.1,
              }}
            >
              <span className="branch-pill-name" style={{ fontSize: 12, fontWeight: 600 }}>
                {user?.branch?.name ?? 'No Branch'}
              </span>
              {user?.branch?.company?.name && (
                <span className="branch-pill-company" style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>
                  {user.branch.company.name}
                </span>
              )}
            </div>
            <ChevronsUpDown size={11} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
          </button>

          {branchMenuOpen && (
            <div
              className="branch-menu"
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
                maxHeight: '60vh',
                overflowY: 'auto',
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
              {availableBranches.map((branch: {
                id?: number
                name?: string
                company?: { name?: string }
              }) => {
                const isActive = branch.id === user?.branch?.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    onClick={() => onSelectBranch(branch.id!)}
                    className="branch-option"
                    data-active={isActive}
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
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: isActive ? 'var(--accent)' : 'var(--foreground)',
                        }}
                      >
                        {branch.name}
                      </span>
                      {branch.company?.name && (
                        <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>
                          {branch.company.name}
                        </span>
                      )}
                    </div>
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

        {/* User menu */}
        <div style={{ position: 'relative' }} ref={ref}>
          <button
            data-tour="user-menu"
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
                  router.push('/profile');
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
