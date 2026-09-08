'use client';

import React, { useState, useEffect } from 'react';
import AppSidebar, { NAV_GROUPS } from '@/components/app-sidebar';
import TopBar from '@/components/top-bar';
import { useShortcut } from '@/hooks/useShortcut';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import PermissionDenied from '@/components/PermissionDenied';

type Props = {
  children: React.ReactNode;
};

export default function GlobalLayout({ children }: Props) {
  const router = useRouter();
  const { user, isLoading, hasPermission, isSuperadmin } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const handleStart = (url: string) => {
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
  const isDenied =
    !isCheckingAuth &&
    !isNavigating &&
    Boolean(user) &&
    !isSuperadmin &&
    Boolean(requiredPermission && !hasRequiredPermission(requiredPermission));

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
        <div className="print-hidden">
          <AppSidebar />
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
            <TopBar />
          </div>

          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              background: 'var(--background)',
              padding: '28px 32px',
            }}
          >
            {isCheckingAuth || isNavigating ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: '360px',
                  gap: 16,
                }}
              >
                <div className="global-page-spinner" />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--foreground-muted)',
                  }}
                >
                  Memuat halaman...
                </span>
              </div>
            ) : isDenied ? (
              <PermissionDenied />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
    </>
  );
}
