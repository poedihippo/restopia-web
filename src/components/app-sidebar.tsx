'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { useActiveBranchProductTypes } from '@/hooks/useProductTypes';
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

export type NavChild = {
  label: string;
  href: string;
  permission?: string | string[];
};

export type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  permission?: string | string[];
  children?: NavChild[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.menu' },
      { label: 'Point of Sale', href: '/pos', icon: ShoppingCart, permission: 'sales-order.menu' },
    ],
  },
  {
    title: 'PRODUCTION',
    items: [
      {
        label: 'Production',
        icon: Factory,
        children: [
          { label: 'Production', href: '/production', permission: 'production.menu' },
          { label: 'Recipes', href: '/production/recipes', permission: 'recipe.menu' },
        ],
      },
      {
        label: 'Product Management',
        icon: Boxes,
        children: [
          { label: 'Products', href: '/products', permission: 'product.menu' },
          { label: 'Product Categories', href: '/products/product-categories', permission: 'product-category.menu' },
          { label: 'Units of Measure', href: '/products/uom', permission: 'uom.menu' },
          { label: 'Stages', href: '/inventory/stages', permission: 'stage.menu' },
          { label: 'Product UOMs', href: '/products/product-uoms', permission: 'product-uom.menu' },
          { label: 'Product UOM Batches', href: '/products/product-uom-batches', permission: 'product-uom-batch.menu' },
          { label: 'Product Conversions', href: '/products/product-conversions', permission: 'product-conversion.menu' },
          { label: 'Price Lists', href: '/products/price-lists', permission: 'price-list.menu' },
        ],
      },
      {
        label: 'Product Inventory',
        icon: Warehouse,
        children: [
          { label: 'Raw Material', href: '/products/product-inventory?type=raw', permission: 'product-inventory.menu' },
          { label: 'Unfinish', href: '/products/product-inventory?type=wip', permission: 'product-inventory.menu' },
          { label: 'Finish Good', href: '/products/product-inventory?type=final', permission: 'product-inventory.menu' },
          { label: 'Supplies', href: '/products/product-inventory?type=supply', permission: 'product-inventory.menu' },
          { label: 'Stock Movements', href: '/products/product-inventory/stock-movements', permission: 'stock-movement.menu' },
          { label: 'Kartu Stok', href: '/products/stock-card', permission: 'stock-movement.read' },
          { label: 'Stok per Dimensi', href: '/products/product-inventory/by-dimension', permission: 'product-inventory.menu' },
          { label: 'Stock Opname', href: '/products/product-inventory/stock-opname', permission: ['stock-opname.menu', 'stock-opname.read', 'product-inventory.menu'] },
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
          { label: 'Purchase Orders', href: '/purchase/purchase-orders', permission: 'purchase-order.menu' },
          { label: 'Internal Orders', href: '/purchase/internal-orders', permission: 'internal-purchase-order.menu' },
          { label: 'Incoming PO Request', href: '/purchase/requested-orders', permission: 'purchase-order.menu' },
          { label: 'Suppliers', href: '/purchase/suppliers', permission: 'supplier.menu' },
          { label: 'Payment PO', href: '/purchase/po-payments', permission: 'payment.menu' },
        ],
      },
      {
        label: 'Transfer',
        icon: ArrowLeftRight,
        children: [
          { label: 'Deliveries', href: '/transfer/deliveries', permission: 'delivery.menu' },
          { label: 'Receipts', href: '/transfer/receipts', permission: 'receipt.menu' },
          { label: 'Stock Transfer', href: '/transfer/stock-transfer', permission: 'delivery.menu' },
          { label: 'Dimension Transfer', href: '/transfer/dimension-transfer', permission: 'stock-movement.menu' },
          { label: 'Dimension Requests', href: '/transfer/dimension-transfer-requests', permission: 'stock-movement.menu' },
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
          { label: 'Sales Orders', href: '/sales/sales-orders', permission: 'sales-order.menu' },
          { label: 'Sales Channels', href: '/sales/sales-channels', permission: 'sales-channel.menu' },
          { label: 'Customers', href: '/sales/customers', permission: 'customer.menu' },
          { label: 'Vouchers', href: '/sales/vouchers', permission: 'voucher.menu' },
          { label: 'Payments', href: '/sales/payments', permission: 'payment.menu' },
        ],
      },
      { label: 'Bundles', href: '/sales/bundles', icon: Package, permission: 'bundle.menu' },
    ],
  },
  {
    title: 'BILLING & INVOICING',
    items: [
      {
        label: 'Invoicing',
        icon: ReceiptText,
        children: [
          { label: 'Invoices', href: '/transfer/invoices', permission: 'invoice.menu' },
        ],
      },
    ],
  },
  {
    title: 'ACCOUNTING',
    items: [
      {
        label: 'Accounting',
        icon: Calculator,
        children: [
          { label: 'Taxes', href: '/accounting/taxes', permission: 'tax.menu' },
          { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', permission: 'chart-of-account.menu' },
          { label: 'Bank Accounts', href: '/accounting/bank-accounts', permission: 'bank_account.read' },
          { label: 'Cash Transactions', href: '/accounting/cash-transactions', permission: 'cash_transaction.read' },
          { label: 'Account Settings', href: '/accounting/account-settings', permission: 'account-setting.menu' },
          { label: 'Branch Account Settings', href: '/accounting/branch-account-settings', permission: 'branch-account-setting.menu' },
          { label: 'Product Category Account Settings', href: '/accounting/product-category-account-settings', permission: 'product-category-account-setting.menu' },
          { label: 'Account Categories', href: '/accounting/account-categories', permission: 'account-category.menu' },
          { label: 'Account Types', href: '/accounting/account-types', permission: 'account-type.menu' },
          { label: 'Journals', href: '/accounting/journals', permission: 'journal.menu' },
          { label: 'Fiscal Years', href: '/accounting/fiscal-years', permission: 'fiscal-year.menu' },
          { label: 'Periods', href: '/accounting/periods', permission: 'period.menu' },
          { label: 'Budgets', href: '/accounting/budgets', permission: 'budget.menu' },
          { label: 'Trial Balance', href: '/accounting/reports/trial-balance', permission: 'journal.menu' },
          { label: 'Income Statement', href: '/accounting/reports/income-statement', permission: 'journal.menu' },
          { label: 'Balance Sheet', href: '/accounting/reports/balance-sheet', permission: 'journal.menu' },
          { label: 'Comparative Reports', href: '/accounting/reports/comparative', permission: 'report.read' },
          { label: 'AP Aging', href: '/accounting/reports/ap-aging', permission: 'journal.menu' },
          { label: 'AR Aging', href: '/accounting/reports/ar-aging', permission: 'report.read' },
          { label: 'Kartu Hutang Supplier', href: '/accounting/reports/supplier-debts', permission: 'report.read' },
          { label: 'Cash Flow', href: '/accounting/reports/cash-flow', permission: 'report.read' },
          { label: 'General Ledger', href: '/accounting/reports/general-ledger', permission: 'report.read' },
          { label: 'Customer Statements', href: '/accounting/reports/customer-statements', permission: 'report.read' },
          { label: 'Supplier Statements', href: '/accounting/reports/supplier-statements', permission: 'report.read' },
          { label: 'Tax Report', href: '/accounting/reports/tax-report', permission: 'report.read' },
          { label: 'Budget vs Actual', href: '/accounting/reports/budget-vs-actual', permission: 'report.read' },
          { label: 'Journal Entries', href: '/accounting/reports/journal-entries', permission: 'report.read' },
          { label: 'Payments Report', href: '/accounting/reports/payments-report', permission: 'report.read' },
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
          { label: 'Sales Report', href: '/reports/sales-report', permission: 'sales-order.menu' },
          { label: 'Sales by Product', href: '/reports/sales-by-product', permission: 'sales-order.menu' },
          { label: 'Sales by Invoice', href: '/reports/sales-by-invoice', permission: 'sales-order.menu' },
          { label: 'Transaction History', href: '/reports/transaction-history', permission: 'sales-order.menu' },
          { label: 'Credit Report', href: '/reports/credit-report', permission: 'sales-order.menu' },
          { label: 'Discount & Voucher', href: '/reports/discount-voucher', permission: 'sales-order.menu' },
          { label: 'Stock Position', href: '/reports/stock-position', permission: 'product-inventory.menu' },
          { label: 'Purchasing Reports', href: '/reports/purchasing', permission: 'report.read' },
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
          { label: 'Users', href: '/users', permission: 'user.menu' },
          { label: 'Roles', href: '/users/roles', permission: 'role.menu' },
        ],
      },
      {
        label: 'Company',
        icon: Building2,
        children: [
          { label: 'Companies', href: '/users/companies', permission: 'company.menu' },
          { label: 'Branches', href: '/users/branches', permission: 'branch.menu' },
          { label: 'Departments', href: '/settings/departments', permission: 'department.read' },
        ],
      },
      { label: 'Permissions', href: '/users/permissions', icon: ShieldCheck, permission: 'permission.menu' },
      { label: 'Payment Methods', href: '/settings/payment-methods', icon: CreditCard, permission: 'payment-method.menu' },
      { label: 'Sales Channels', href: '/settings/sales-channels', icon: Store, permission: 'sales-channel.menu' },
      { label: 'Employees', href: '/settings/employees', icon: UserCheck, permission: 'user.menu' },
      { label: 'Audit Logs', href: '/settings/audit-logs', icon: BookOpen, permission: 'audit-log.menu' },
      {
        label: 'Store Operations',
        icon: Store,
        children: [
          { label: 'Operation Rules', href: '/settings/operation-rules', permission: 'operation-rule.menu' },
          { label: 'Operations', href: '/settings/operations', permission: 'operation.menu' },
          { label: 'Shift Rules', href: '/settings/shift-rules', permission: 'shift-rule.menu' },
          { label: 'Shifts', href: '/settings/shifts', permission: 'shift.menu' },
        ],
      },
    ],
  },
];

export default function AppSidebar() {
  const router = useRouter();
  const { hasPermission, isSuperadmin } = useAuth();
  const activeProductTypes = useActiveBranchProductTypes();
  const allowedProductTypes = activeProductTypes
    ? activeProductTypes.split(',').map((s) => s.trim().toLowerCase())
    : null;
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isItemVisible = (item: NavItem): boolean => {
    if (isSuperadmin) return true;
    if (!item.permission) return true;
    if (Array.isArray(item.permission)) {
      return item.permission.some((p) => hasPermission(p));
    }
    return hasPermission(item.permission);
  };

  const isChildAllowedByProductType = (href: string): boolean => {
    if (!allowedProductTypes) return true;
    if (href.includes('/products/product-inventory?type=')) {
      const typeParam = href.split('type=')[1]?.split('&')[0]?.toLowerCase();
      if (typeParam) {
        return (
          allowedProductTypes.includes(typeParam) ||
          (typeParam === 'supply' && allowedProductTypes.includes('supplies'))
        );
      }
    }
    return true;
  };

  const visibleChildren = (item: NavItem): NavChild[] =>
    (item.children ?? [])
      .filter((child) => {
        if (isSuperadmin || !child.permission) return true;
        if (Array.isArray(child.permission)) {
          return child.permission.some((p) => hasPermission(p));
        }
        return hasPermission(child.permission);
      })
      .filter((child) => isChildAllowedByProductType(child.href));

  useEffect(() => {
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.children) {
          const hasActive = item.children.some(
            (child) => {
              if (router.asPath === child.href || router.asPath.startsWith(child.href + '&')) return true;
              const basePath = child.href.split('?')[0];
              return router.pathname === basePath || router.pathname.startsWith(basePath + '/');
            }
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
    if (router.asPath === href) return true;
    if (href.includes('?') && router.asPath.startsWith(href + '&')) return true;
    if (!href.includes('?') && router.pathname === href) return true;
    
    const hrefBase = href.split('?')[0];

    if (hrefBase !== '/dashboard' && router.pathname.startsWith(hrefBase + '/')) {
      const allHrefs = NAV_GROUPS.flatMap((g) =>
        g.items.flatMap((i) => (i.children ? i.children.map((c) => c.href) : [i.href]))).filter(Boolean) as string[];

      const hasLongerMatch = allHrefs.some(
        (otherHref) => {
          const otherBase = otherHref.split('?')[0];
          return otherBase.length > hrefBase.length &&
            (router.pathname === otherBase || router.pathname.startsWith(otherBase + '/'))
        }
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
