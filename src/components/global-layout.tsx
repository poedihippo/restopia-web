'use client';

import React, { useState, useEffect } from 'react';
import AppSidebar, { NAV_GROUPS } from '@/components/app-sidebar';
import TopBar from '@/components/top-bar';
import { useShortcut } from '@/hooks/useShortcut';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import PermissionDenied from '@/components/PermissionDenied';
import PageLoader from '@/components/PageLoader';
import { auditNavPermissions } from '@/lib/permissions';
import { isUiV2Route } from '@/lib/uiPreview';
import DatePopover from '@/components/DatePopover';
import { recordRecentPage } from '@/lib/recentPages';
import ProductTour from '@/components/tour/ProductTour';

type Props = {
  children: React.ReactNode;
};

export default function GlobalLayout({ children }: Props) {
  const router = useRouter();
  const { user, isLoading, hasPermission, isSuperadmin } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Ctrl+F / ⌘F focuses the current screen's search box (lists are paginated,
  // so the browser's find bar would only see one page; the box searches the
  // server). Falls back to the browser's find when there is no box, or when
  // the box is already focused.
  useEffect(() => {
    const SEARCH_SELECTOR = [
      'main input[data-search]',
      'main input[type="search"]',
      'main input[placeholder*="search" i]',
      'main input[placeholder*="cari" i]',
    ].join(', ');
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== 'f') return;
      const box = Array.from(document.querySelectorAll<HTMLInputElement>(SEARCH_SELECTOR)).find(
        (el) => !el.disabled && el.offsetParent !== null,
      );
      if (!box || document.activeElement === box) return;
      e.preventDefault();
      box.focus();
      box.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // "Terakhir dibuka" on the dashboards: remember each sidebar menu this viewer opens.
  useEffect(() => {
    if (router.isReady) recordRecentPage(router.asPath);
  }, [router.isReady, router.asPath]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileNavOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    const handleStart = (url: string) => {
      setMobileNavOpen(false);
      const targetPath = url.split('?')[0];
      const currentPath = router.asPath.split('?')[0];
      if (targetPath !== currentPath) {
        setIsNavigating(true);
      }
    };
    const handleComplete = () => setIsNavigating(false);
    const handleError = () => setIsNavigating(false);

    router.events.on('routeChangeStart', handleStart);
    router.events.on('routeChangeComplete', handleComplete);
    router.events.on('routeChangeError', handleError);

    return () => {
      router.events.off('routeChangeStart', handleStart);
      router.events.off('routeChangeComplete', handleComplete);
      router.events.off('routeChangeError', handleError);
    };
  }, [router]);

  let requiredPermission: string | string[] | undefined = undefined;
  let maxMatchLength = 0;
  const currentPath = router.pathname;

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href) {
        const baseHref = item.href.split('?')[0];
        if (currentPath === baseHref || currentPath.startsWith(baseHref + '/')) {
          if (baseHref.length > maxMatchLength) {
            maxMatchLength = baseHref.length;
            requiredPermission = item.permission;
          }
        }
      }
      if (item.children) {
        for (const child of item.children) {
          if (child.href) {
            const childBaseHref = child.href.split('?')[0];
            if (currentPath === childBaseHref || currentPath.startsWith(childBaseHref + '/')) {
              if (childBaseHref.length > maxMatchLength) {
                maxMatchLength = childBaseHref.length;
                requiredPermission = child.permission;
              }
            }
          }
        }
      }
    }
  }

  const hasRequiredPermission = (perm?: string | string[]): boolean => {
    if (!perm) return true;
    if (Array.isArray(perm)) return perm.some((p) => hasPermission(p));
    return hasPermission(perm);
  };

  const isCheckingAuth = isLoading || !router.isReady;
  const uiV2 = isUiV2Route(currentPath);

  // While the page area shows its loading spinner, the sidebar glow stays hidden.
  const pageLoading = isCheckingAuth || isNavigating;
  useEffect(() => {
    const root = document.documentElement;
    if (pageLoading) root.dataset.pageLoading = '';
    else delete root.dataset.pageLoading;
  }, [pageLoading]);

  // The attribute lives on <html> so portaled overlays pick up the v2 tokens too.
  useEffect(() => {
    const root = document.documentElement;
    if (uiV2) root.dataset.ui = 'v2';
    else delete root.dataset.ui;
  }, [uiV2]);
  const isDenied =
    !isCheckingAuth &&
    !isNavigating &&
    Boolean(user) &&
    !isSuperadmin &&
    Boolean(requiredPermission && !hasRequiredPermission(requiredPermission));

  // Dev-only guard: warn when a menu/route is hidden even though the user holds
  // a permission on the same resource (i.e. an action-key mismatch bug).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (!user || isSuperadmin || isCheckingAuth) return;
    const granted = (user.permissions ?? []).map((p: any) => p.name).filter(Boolean);
    const findings = auditNavPermissions(NAV_GROUPS, granted);
    if (findings.length > 0) {
      console.warn(
        '[permissions] Nav entries hidden — user HAS a permission on the same resource, check the action key:',
        findings,
      );
    }
  }, [user, isSuperadmin, isCheckingAuth]);

  useShortcut({
    key: 'b',
    ctrlKey: true,
    onAction: () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const createBtn = buttons.find((b) => {
        const text = b.textContent?.trim().toLowerCase() || '';
        return (
          (text.startsWith('new ') || 
           text.startsWith('create ') || 
           text.startsWith('record ') || 
           text === 'new') &&
          !b.disabled
        );
      });
      if (createBtn) {
        createBtn.click();
      }
    },
  });

  return (
    <>
      <style>{`
        /* Footer sticks to the bottom on short pages: <main> is a column and the
           footer takes the leftover space as top margin. Page roots must not shrink. */
        .app-main { display: flex; flex-direction: column; }
        .app-main > * { flex-shrink: 0; }
        .app-footer { margin-top: auto !important; }
        /* Pages fill the content area: no page container. Views set a centered
           cap on their root (maxWidth 960-1400 and/or margin: 0 auto, which in this
           flex column also shrinks the page to its content); drop both for every
           page root. Fixed overlays (dialogs) and the footer keep their own. */
        .app-main > *:not(.app-footer):not([style*="position: fixed"]):not([aria-hidden]) {
          max-width: none !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          align-self: stretch;
        }
        @keyframes page-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .global-page-spinner {
          width: 38px;
          height: 38px;
          border: 3px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: page-spin 0.75s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes nav-progress {
          0% { left: -40%; width: 40%; }
          50% { left: 20%; width: 60%; }
          100% { left: 100%; width: 40%; }
        }
        .global-nav-progress-bar {
          position: absolute;
          top: 0;
          left: 0;
          height: 3px;
          background: var(--accent);
          border-radius: 2px;
          animation: nav-progress 1.2s ease-in-out infinite;
        }
        /* Phones: sidebar becomes an off-canvas drawer opened from the top bar. */
        .topbar-menu-btn { display: none; }
        .mobile-nav-backdrop { display: none; }
        @media (max-width: 767px) {
          .app-sidebar {
            position: fixed !important; top: 0; left: 0; bottom: 0; z-index: 80;
            width: 264px !important; height: 100dvh !important;
            transform: translateX(-100%); transition: transform 220ms ease !important;
          }
          .app-sidebar[data-mobile-open="true"] { transform: none; box-shadow: 12px 0 40px rgba(0, 0, 0, 0.18); }
          .app-sidebar-collapse { display: none; }
          .topbar > nav { flex: 1; min-width: 0; overflow: hidden; }
          .mobile-nav-backdrop { display: block; position: fixed; inset: 0; z-index: 79; background: rgba(24, 20, 30, 0.32); }
          .topbar-menu-btn {
            display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
            width: 34px; height: 34px; margin-right: 6px; border: none; border-radius: 8px;
            background: transparent; color: var(--foreground); cursor: pointer;
          }
          .topbar-menu-btn:hover { background: var(--background); }
        }
        @media print {
          #__next {
            display: flex !important;
            height: auto !important;
          }
          .print-hidden {
            display: none !important;
          }
          .print-visible-scroll {
            overflow: visible !important;
            height: auto !important;
            width: auto !important;
            display: block !important;
          }
          main {
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            display: block !important;
          }
          body, html {
            height: auto !important;
            overflow: visible !important;
            background: #fff !important;
          }
        }
      `}</style>
      {uiV2 && <DatePopover />}
      <ProductTour ready={!isCheckingAuth && !isNavigating && Boolean(user) && !isDenied} />
      {isNavigating && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            zIndex: 99999,
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.06)',
          }}
        >
          <div className="global-nav-progress-bar" />
        </div>
      )}
      <div
        className="print-visible-scroll"
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          background: 'var(--background)',
        }}
      >
        {mobileNavOpen && <div className="mobile-nav-backdrop print-hidden" onClick={() => setMobileNavOpen(false)} />}
        <div className="print-hidden">
          <AppSidebar mobileOpen={mobileNavOpen} />
        </div>

        <div
          className="print-visible-scroll"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            minWidth: 0,
          }}
        >
          <div className="print-hidden">
            <TopBar onMenuClick={() => setMobileNavOpen(true)} />
          </div>

          <main
            className="app-main"
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'var(--background)',
              padding: uiV2 ? '20px 24px' : '28px 32px',
            }}
          >
            {isCheckingAuth || isNavigating ? (
              <PageLoader />
            ) : isDenied ? (
              <PermissionDenied />
            ) : (
              <>
                {children}
                <div aria-hidden style={{ height: 32 }} />
                <footer
                  className="print-hidden app-footer"
                  style={{
                    // Negative side/bottom margins cancel <main>'s padding so the gray bar spans edge to edge;
                    // top margin is auto (.app-footer) with a 32px minimum gap kept by the spacer below.
                    margin: uiV2 ? '0 -24px -20px' : '0 -32px -28px',
                    padding: '14px 24px',
                    background: 'var(--surface-muted, var(--muted))',
                    borderTop: '1px solid var(--border)',
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--foreground-subtle)',
                  }}
                >
                  {new Date().getFullYear()} © Dapur Cokelat
                </footer>
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
