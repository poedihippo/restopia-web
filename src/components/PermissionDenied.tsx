import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function PermissionDenied() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          padding: '48px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 400,
          width: '100%',
        }}
      >
        <ShieldAlert size={64} style={{ color: 'var(--destructive)', marginBottom: 24 }} />
        
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: 'var(--foreground)',
            marginBottom: 8,
            fontFamily: 'var(--font-display)',
          }}
        >
          Permission Denied
        </h1>
        
        <p
          style={{
            fontSize: 14,
            color: 'var(--foreground-muted)',
            marginBottom: 32,
            lineHeight: 1.5,
          }}
        >
          You do not have the required permission to view this page. If you believe this is an error, please contact your administrator.
        </p>
        
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 20px',
            background: 'var(--foreground)',
            color: 'var(--background)',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'opacity 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
