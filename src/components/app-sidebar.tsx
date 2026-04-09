'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Warehouse,
  Truck,
  PackageSearch,
  Users,
  ChevronLeft,
  ChevronRight,
  Store,
  ReceiptText,
  Tag,
  BookOpen,
  Package,
  ArrowLeftRight,
  Building2,
  ShieldCheck,
  Boxes,
  ChevronDown,
  Wallet,
} from 'lucide-react';

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Point of Sale', href: '/pos', icon: ShoppingCart },
    ],
  },
  {
    title: 'PRODUCTION',
    items: [
      {
        label: 'Production',
        icon: Factory,
        children: [
          { label: 'Factory', href: '/production' },
          { label: 'Recipes', href: '/production/recipes' },
        ],
      },
      {
        label: 'Inventory',
        icon: Boxes,
        children: [
          { label: 'Products', href: '/products' },
          { label: 'Categories', href: '/products/product-categories' },
          { label: 'UOM', href: '/products/uom' },
          { label: 'Product UOMs', href: '/products/product-uoms' },
          { label: 'Conversions', href: '/products/product-conversions' },
          { label: 'Stock', href: '/products/product-inventory' },
          { label: 'Movements', href: '/products/product-inventory/stock-movements' },
        ],
      },
    ],
  },
  {
    title: 'PROCUREMENT',
    items: [
      {
        label: 'Purchase Orders',
        icon: PackageSearch,
        children: [
          { label: 'Orders', href: '/purchase/purchase-orders' },
          { label: 'Suppliers', href: '/purchase/suppliers' },
        ],
      },
      {
        label: 'Transfer',
        icon: ArrowLeftRight,
        children: [
          { label: 'Deliveries', href: '/transfer/deliveries' },
          { label: 'Receipts', href: '/transfer/receipts' },
        ],
      },
    ],
  },
  {
    title: 'SALES',
    items: [
      {
        label: 'Sales Orders',
        icon: ReceiptText,
        children: [
          { label: 'Orders', href: '/sales/sales-orders' },
          { label: 'Customers', href: '/sales/customers' },
          { label: 'Vouchers', href: '/sales/vouchers' },
        ],
      },
      { label: 'Bundles', href: '/bundles', icon: Tag },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      {
        label: 'Users',
        icon: Users,
        children: [
          { label: 'All Users', href: '/users' },
          { label: 'Roles', href: '/users/roles' },
          { label: 'Branches', href: '/users/branches' },
          { label: 'Companies', href: '/users/companies' },
        ],
      },
      { label: 'Permissions', href: '/users/permissions', icon: ShieldCheck },
      { label: 'Payment Methods', href: '/settings/payment-methods', icon: Wallet },
    ],
  },
];

export default function AppSidebar() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children) {
          const hasActive = item.children.some(
            (child) =>
              router.pathname === child.href ||
              router.pathname.startsWith(child.href + '/')
          );
          if (hasActive) {
            initial[item.label] = true;
          }
        }
      }
    }
    setOpenGroups(initial);
  }, [router.pathname]);

  function toggleGroup(label: string) {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function isActive(href: string): boolean {
    if (router.pathname === href) return true;
    if (href !== '/dashboard' && router.pathname.startsWith(href + '/')) return true;
    return false;
  }

  return (
    <aside
      style={{
        width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
        transition: 'width 200ms ease',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '16px 12px',
          borderBottom: '1px solid var(--sidebar-border)',
        }}
      >
        {collapsed ? (
          <div
            style={{
              width: 32,
              height: 32,
              background: 'var(--accent)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <span
              style={{
                color: 'white',
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              D
            </span>
          </div>
        ) : (
          <div>
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--accent)',
                }}
              >
                Dapur
              </span>
            </div>
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: 2,
                  color: 'var(--foreground-muted)',
                  textTransform: 'uppercase',
                }}
              >
                Coklat
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Nav scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            {!collapsed && (
              <div
                style={{
                  padding: '12px 16px 4px',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: 1.5,
                  color: 'var(--sidebar-text-muted)',
                  textTransform: 'uppercase',
                }}
              >
                {group.title}
              </div>
            )}

            {group.items.map((item) => {
              const Icon = item.icon;

              if (!item.children) {
                const active = isActive(item.href!);
                return (
                  <Link
                    key={item.label}
                    href={item.href!}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: collapsed ? '10px 0' : '8px 12px',
                      margin: '1px 8px',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      fontSize: 13.5,
                      fontWeight: active ? 500 : 400,
                      color: active ? 'var(--sidebar-item-active-text)' : 'var(--sidebar-text)',
                      background: active ? 'var(--sidebar-item-active-bg)' : 'transparent',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      transition: 'background 150ms ease',
                    }}
                  >
                    <Icon size={16} />
                    {!collapsed && (
                      <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                    )}
                  </Link>
                );
              }

              const isOpen = !!openGroups[item.label];
              const anyChildActive = item.children.some((c) => isActive(c.href));

              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleGroup(item.label)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: collapsed ? '10px 0' : '8px 12px',
                      margin: '1px 8px',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 13.5,
                      fontWeight: anyChildActive ? 500 : 400,
                      color: anyChildActive ? 'var(--sidebar-item-active-text)' : 'var(--sidebar-text)',
                      background: anyChildActive ? 'var(--sidebar-item-active-bg)' : 'transparent',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      transition: 'background 150ms ease',
                      cursor: 'pointer',
                      border: 'none',
                      width: 'calc(100% - 16px)',
                    }}
                  >
                    <Icon size={16} />
                    {!collapsed && (
                      <>
                        <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                        <ChevronDown
                          size={14}
                          style={{
                            marginLeft: 'auto',
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 150ms ease',
                          }}
                        />
                      </>
                    )}
                  </button>

                  {isOpen && !collapsed && (
                    <div>
                      {item.children.map((child) => {
                        const childActive = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            style={{
                              padding: '6px 12px 6px 38px',
                              margin: '1px 8px',
                              fontSize: 13,
                              color: childActive ? 'var(--accent)' : 'var(--foreground-muted)',
                              fontWeight: childActive ? 500 : 400,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              borderRadius: 'var(--radius-md)',
                              textDecoration: 'none',
                              background: childActive ? 'var(--accent-light-bg)' : 'transparent',
                            }}
                          >
                            <div
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: 99,
                                background: childActive ? 'var(--accent-light)' : 'var(--border-strong)',
                                flexShrink: 0,
                              }}
                            />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Collapse toggle */}
      <div
        style={{
          borderTop: '1px solid var(--sidebar-border)',
          padding: '12px 8px',
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-end',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--foreground-muted)',
            padding: 4,
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
