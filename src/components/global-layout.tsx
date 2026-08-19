'use client';

import React from 'react';
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
  const { hasPermission, isSuperadmin } = useAuth();

  let requiredPermission: string | undefined = undefined;
  let maxMatchLength = 0;
  const currentPath = router.pathname;

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.href) {
        const baseHref = item.href.split('?')[0];
        if (currentPath.startsWith(baseHref)) {
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
            if (currentPath.startsWith(childBaseHref)) {
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

  const isDenied = !isSuperadmin && requiredPermission && !hasPermission(requiredPermission);

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
          {isDenied ? <PermissionDenied /> : children}
        </main>
      </div>
      </div>
    </>
  );
}
