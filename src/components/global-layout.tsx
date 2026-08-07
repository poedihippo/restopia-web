'use client';

import React from 'react';
import AppSidebar from '@/components/app-sidebar';
import TopBar from '@/components/top-bar';
import { useShortcut } from '@/hooks/useShortcut';

type Props = {
  children: React.ReactNode;
};

export default function GlobalLayout({ children }: Props) {
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
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--background)',
      }}
    >
      <AppSidebar />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <TopBar />

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--background)',
            padding: '28px 32px',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
