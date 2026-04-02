'use client';

import React from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Factory,
  PackageSearch,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
} from 'lucide-react';

type StatCard = {
  label: string;
  value: string;
  delta: string;
  deltaType: 'up' | 'down';
  icon: React.ElementType;
  description: string;
};

const STAT_CARDS: StatCard[] = [
  {
    label: 'Total Sales',
    value: 'Rp 0',
    delta: '+0%',
    deltaType: 'up',
    icon: ShoppingBag,
    description: 'vs. last month',
  },
  {
    label: 'Productions',
    value: '0',
    delta: '+0',
    deltaType: 'up',
    icon: Factory,
    description: 'batches this month',
  },
  {
    label: 'Purchase Orders',
    value: '0',
    delta: '0 pending',
    deltaType: 'down',
    icon: PackageSearch,
    description: 'awaiting fulfillment',
  },
  {
    label: 'Stock Items',
    value: '0',
    delta: '0 low',
    deltaType: 'down',
    icon: Boxes,
    description: 'across all branches',
  },
];

export default function DashboardView() {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* SECTION 1 — Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26,
              fontWeight: 500,
              margin: 0,
              color: 'var(--foreground)',
            }}
          >
            Dashboard
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--foreground-muted)',
              margin: '4px 0 0 0',
            }}
          >
            Welcome back. Here's what's happening today.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 12,
            color: 'var(--foreground-muted)',
            fontWeight: 500,
          }}
        >
          <TrendingUp size={13} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
          <span>{today}</span>
        </div>
      </div>

      {/* SECTION 2 — Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {STAT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Top row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--foreground-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  {card.label}
                </span>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    background: 'var(--accent-light-bg)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} style={{ color: 'var(--accent-light)' }} />
                </div>
              </div>

              {/* Value */}
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: 'var(--foreground)',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: -0.5,
                }}
              >
                {card.value}
              </span>

              {/* Footer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {card.deltaType === 'up' ? (
                  <ArrowUpRight size={13} style={{ color: 'var(--success)', flexShrink: 0 }} />
                ) : (
                  <ArrowDownRight size={13} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: card.deltaType === 'up' ? 'var(--success)' : 'var(--foreground-muted)',
                  }}
                >
                  {card.delta}
                </span>
                <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
                  {card.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SECTION 3 — Placeholder panels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 16,
        }}
      >
        {/* Panel A — Recent Activity */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Recent Activity
            </span>
            <span style={{ fontSize: 12, color: 'var(--foreground-muted)' }}>
              Today
            </span>
          </div>
          <div
            style={{
              padding: '40px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--foreground-subtle)' }}>
              No activity yet
            </span>
            <span style={{ fontSize: 12, color: 'var(--foreground-subtle)' }}>
              Sales and production events will appear here
            </span>
          </div>
        </div>

        {/* Panel B — Quick Actions */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Quick Actions
            </span>
          </div>
          <div style={{ padding: 12 }}>
            {(
              [
                { icon: ShoppingBag,   label: 'New Sale' },
                { icon: Factory,       label: 'New Production' },
                { icon: PackageSearch, label: 'New Purchase Order' },
                { icon: Boxes,         label: 'View Stock' },
              ] as { icon: React.ElementType; label: string }[]
            ).map(({ icon: Icon, label }) => (
              <button
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '9px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 13,
                  color: 'var(--foreground)',
                  fontWeight: 400,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    background: 'var(--accent-light-bg)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} style={{ color: 'var(--accent-light)' }} />
                </div>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
