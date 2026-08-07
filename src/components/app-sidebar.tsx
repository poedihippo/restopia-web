'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
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
  CreditCard,
  UserCheck,
  BarChart3,
  Calculator,
} from 'lucide-react';

type NavChild = {
  label: string;
  href: string;
  permission?: string;
};

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  permission?: string;
  children?: NavChild[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
      { label: 'Point of Sale', href: '/pos', icon: ShoppingCart, permission: 'sales-order.create' },
    ],
  },
  {
    title: 'PRODUCTION',
    items: [
      {
        label: 'Production',
        icon: Factory,
        children: [
          { label: 'Production', href: '/production', permission: 'production.read' },
          { label: 'Recipes', href: '/production/recipes', permission: 'recipe.read' },
        ],
      },
      {
        label: 'Inventory',
        icon: Boxes,
        children: [
          { label: 'Products', href: '/products', permission: 'product.read' },
          { label: 'Product Categories', href: '/products/product-categories', permission: 'product-category.read' },
          { label: 'Units of Measure', href: '/products/uom', permission: 'uom.read' },
          { label: 'Product UOMs', href: '/products/product-uoms', permission: 'product-uom.read' },
          { label: 'Product UOM Batches', href: '/products/product-uom-batches', permission: 'product-uom-batch.read' },
          { label: 'Product Conversions', href: '/products/product-conversions', permission: 'product-conversion.read' },
          { label: 'Product Inventory', href: '/products/product-inventory', permission: 'product-inventory.read' },
          { label: 'Price Lists', href: '/products/price-lists', permission: 'price-list.read' },
          { label: 'Stock Movements', href: '/products/product-inventory/stock-movements', permission: 'stock-movement.read' },
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
          { label: 'Purchase Orders', href: '/purchase/purchase-orders', permission: 'purchase-order.read' },
          { label: 'Internal Orders', href: '/purchase/internal-orders', permission: 'internal-purchase-order.read' },
          { label: 'Requested PO', href: '/purchase/requested-orders', permission: 'purchase-order.read' },
          { label: 'Suppliers', href: '/purchase/suppliers', permission: 'supplier.read' },
          { label: 'Payment PO', href: '/purchase/po-payments', permission: 'payment.create' },
        ],
      },
      {
        label: 'Transfer',
        icon: ArrowLeftRight,
        children: [
          { label: 'Deliveries', href: '/transfer/deliveries', permission: 'delivery.read' },
          { label: 'Receipts', href: '/transfer/receipts', permission: 'receipt.read' },
          { label: 'Invoices', href: '/transfer/invoices', permission: 'invoice.read' },
          { label: 'Stock Transfer', href: '/transfer/stock-transfer', permission: 'delivery.create' },
          { label: 'Dimension Transfer', href: '/transfer/dimension-transfer', permission: 'stock-movement.create' },
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
          { label: 'Sales Orders', href: '/sales/sales-orders', permission: 'sales-order.read' },
          { label: 'Sales Channels', href: '/sales/sales-channels', permission: 'sales-channel.read' },
          { label: 'Customers', href: '/sales/customers', permission: 'customer.read' },
          { label: 'Vouchers', href: '/sales/vouchers', permission: 'voucher.read' },
          { label: 'Payments', href: '/sales/payments', permission: 'payment.read' },
        ],
      },
      { label: 'Bundles', href: '/sales/bundles', icon: Package, permission: 'bundle.read' },
    ],
  },
  {
    title: 'ACCOUNTING',
    items: [
      {
        label: 'Accounting',
        icon: Calculator,
        children: [
          { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', permission: 'chart-of-account.read' },
          { label: 'Account Settings', href: '/accounting/account-settings', permission: 'account-setting.read' },
          { label: 'Account Categories', href: '/accounting/account-categories', permission: 'account-category.read' },
          { label: 'Account Types', href: '/accounting/account-types', permission: 'account-type.read' },
          { label: 'Journals', href: '/accounting/journals', permission: 'journal.read' },
          { label: 'Fiscal Years', href: '/accounting/fiscal-years', permission: 'fiscal-year.read' },
          { label: 'Periods', href: '/accounting/periods', permission: 'period.read' },
          { label: 'Budgets', href: '/accounting/budgets', permission: 'budget.read' },
          { label: 'Trial Balance', href: '/accounting/reports/trial-balance', permission: 'journal.read' },
          { label: 'Income Statement', href: '/accounting/reports/income-statement', permission: 'journal.read' },
          { label: 'Balance Sheet', href: '/accounting/reports/balance-sheet', permission: 'journal.read' },
          { label: 'AP Aging', href: '/accounting/reports/ap-aging', permission: 'journal.read' },
        ],
      },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      {
        label: 'Reports',
        icon: BarChart3,
        children: [
          { label: 'Sales Report', href: '/reports/sales-report', permission: 'sales-order.read' },
          { label: 'Sales by Product', href: '/reports/sales-by-product', permission: 'sales-order.read' },
          { label: 'Sales by Invoice', href: '/reports/sales-by-invoice', permission: 'sales-order.read' },
          { label: 'Transaction History', href: '/reports/transaction-history', permission: 'sales-order.read' },
          { label: 'Credit Report', href: '/reports/credit-report', permission: 'sales-order.read' },
          { label: 'Discount & Voucher', href: '/reports/discount-voucher', permission: 'sales-order.read' },
          { label: 'Stock Position', href: '/reports/stock-position', permission: 'product-inventory.read' },
        ],
      },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      {
        label: 'Users',
        icon: Users,
        children: [
          { label: 'Users', href: '/users', permission: 'user.read' },
          { label: 'Roles', href: '/users/roles', permission: 'role.read' },
        ],
      },
      {
        label: 'Company',
        icon: Building2,
        children: [
          { label: 'Companies', href: '/users/companies', permission: 'company.read' },
          { label: 'Branches', href: '/users/branches', permission: 'branch.read' },
        ],
      },
      { label: 'Permissions', href: '/users/permissions', icon: ShieldCheck, permission: 'permission.read' },
      { label: 'Payment Methods', href: '/settings/payment-methods', icon: CreditCard, permission: 'payment-method.read' },
      { label: 'Sales Channels', href: '/settings/sales-channels', icon: Store, permission: 'sales-channel.read' },
      { label: 'Employees', href: '/settings/employees', icon: UserCheck, permission: 'user.read' },
      {
        label: 'Store Operations',
        icon: Store,
        children: [
          { label: 'Operation Rules', href: '/settings/operation-rules', permission: 'operation-rule.read' },
          { label: 'Operations', href: '/settings/operations', permission: 'operation.read' },
          { label: 'Shift Rules', href: '/settings/shift-rules', permission: 'shift-rule.read' },
          { label: 'Shifts', href: '/settings/shifts', permission: 'shift.read' },
        ],
      },
    ],
  },
];

export default function AppSidebar() {
  const router = useRouter();
  const { hasPermission, isSuperadmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isItemVisible = (item: NavItem): boolean => {
    if (isSuperadmin) return true;
    if (!item.permission) return true;
    return hasPermission(item.permission);
  };

  const visibleChildren = (item: NavItem): NavChild[] =>
    (item.children ?? []).filter(
      (child) => isSuperadmin || !child.permission || hasPermission(child.permission),
    );

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
    if (href !== '/dashboard' && router.pathname.startsWith(href + '/')) {
      const allHrefs = NAV_GROUPS.flatMap((g) =>
        g.items.flatMap((i) => (i.children ? i.children.map((c) => c.href) : [i.href]))).filter(Boolean) as string[];

      const hasLongerMatch = allHrefs.some(
        (otherHref) =>
          otherHref.length > href.length &&
          (router.pathname === otherHref || router.pathname.startsWith(otherHref + '/'))
      );

      if (hasLongerMatch) {
        return false;
      }
      return true;

    }
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
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (!isItemVisible(item)) return false;
            if (item.children) {
              return visibleChildren(item).length > 0;
            }
            return true;
          });
          if (visibleItems.length === 0) return null;
          return (
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

              {visibleItems.map((item) => {
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

                const children = visibleChildren(item);
                if (children.length === 0) return null;

                const isOpen = !!openGroups[item.label];
                const anyChildActive = children.some((c) => isActive(c.href));

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
                        {children.map((child) => {
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
          );
        })}
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
