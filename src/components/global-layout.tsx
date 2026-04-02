'use client';

import React from 'react';
import AppSidebar from '@/components/app-sidebar';
import TopBar from '@/components/top-bar';

type Props = {
  children: React.ReactNode;
};

export default function GlobalLayout({ children }: Props) {
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
