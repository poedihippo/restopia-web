'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ChevronDown,
  Wallet,
  Settings2,
  Globe,
  Hourglass,
  UserCheck,
  BarChart3,
  Calculator,
  Layers,
  SlidersHorizontal,
  Landmark,
  Scale,
  HandCoins,
  Banknote,
  UserCog,
  Handshake,
  Repeat,
  PieChart,
  ChefHat,
  Ruler,
  ListOrdered,
  Scissors,
  Tags,
  PackagePlus,
  GitBranch,
  Network,
} from 'lucide-react';

export type NavChild = {
  label: string;
  href: string;
  permission?: string | string[];
  // Kept in NAV_GROUPS (route permission gating still applies) but not shown in the sidebar.
  hidden?: boolean;
  // Sales channel marker: icon + coloured channel word, so Offline/Online can't be mixed up.
  channel?: 'offline' | 'online';
};

const CHANNEL_META = {
  offline: { icon: Store, word: 'Offline', color: 'var(--pastel-gold-ink, #A87810)' },
  online: { icon: Globe, word: 'Online', color: 'var(--pastel-blue-ink, #3B6FE0)' },
} as const;

export type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  permission?: string | string[];
  children?: NavChild[];
  // Kept in NAV_GROUPS (route permission gating still applies) but not shown in the sidebar.
  hidden?: boolean;
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
      { label: 'Point of Sale', href: '/pos', icon: ShoppingCart, permission: 'point-of-sale.menu' },
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
  {
    title: 'PRODUCTION',
    items: [
      { label: 'Productions', href: '/production', icon: Factory, permission: 'production.menu' },
      { label: 'Conversions', href: '/production/conversion', icon: Repeat, permission: 'production.menu', hidden: true },
      { label: 'Recipes', href: '/production/recipes', icon: ChefHat, permission: 'recipe.menu' },
    ],
  },
  {
    title: 'PORTIONING',
    items: [
      { label: 'Portioning', href: '/production/portioning', icon: PieChart, permission: ['production.menu', 'portioning.menu'] },
      { label: 'Product Cuts', href: '/products/product-cuts', icon: Scissors, permission: ['product-cut.menu', 'product.menu'] },
    ],
  },
  {
    title: 'PRODUCTS',
    items: [
      { label: 'Products', href: '/products', icon: Package, permission: 'product.menu' },
      { label: 'Bundles', href: '/sales/bundles', icon: PackagePlus, permission: 'bundle.menu' },
      { label: 'Product Categories', href: '/products/product-categories', icon: Tag, permission: 'product-category.menu' },
      { label: 'Units of Measure', href: '/products/uom', icon: Ruler, permission: 'uom.menu' },
      { label: 'Stages', href: '/inventory/stages', icon: ListOrdered, permission: 'stage.menu' },
      { label: 'Price Lists', href: '/products/price-lists', icon: Tags, permission: 'price-list.menu' },
    ],
  },
  {
    title: 'INVENTORY',
    items: [
      {
        label: 'Stock',
        icon: Warehouse,
        children: [
          { label: 'Raw Materials', href: '/products/product-inventory?type=raw', permission: ['product-inventory-raw.menu', 'product-inventory.menu'] },
          { label: 'WIP - Unfinish', href: '/products/product-inventory?type=wip', permission: ['product-inventory-wip.menu', 'product-inventory.menu'] },
          { label: 'Final - Finished', href: '/products/product-inventory?type=final', permission: ['product-inventory-final.menu', 'product-inventory.menu'] },
          { label: 'Supplies', href: '/products/product-inventory?type=supply', permission: ['product-inventory-supply.menu', 'product-inventory.menu'] },
        ],
      },
      {
        label: 'Movements',
        icon: ArrowLeftRight,
        children: [
          // Menu "Stock Movements" (semua tipe) tidak ditampilkan — pakai Raw / WIP / Final.
          { label: 'Raw Materials', href: '/products/product-inventory/stock-movements?product_types=raw', permission: 'stock-movement.menu' },
          { label: 'WIP - Unfinish', href: '/products/product-inventory/stock-movements?product_types=wip', permission: 'stock-movement.menu' },
          { label: 'Final - Finished', href: '/products/product-inventory/stock-movements?product_types=final', permission: 'stock-movement.menu' },
          { label: 'Supplies', href: '/products/product-inventory/stock-movements?product_types=supply', permission: 'stock-movement.menu' },
        ],
      },
      {
        label: 'Monitor',
        icon: Layers,
        children: [
          { label: 'Kartu Stok', href: '/products/stock-card', permission: 'stock-movement.menu' },
          { label: 'SR/DN/Outlet', href: '/products/stock-per-branch', permission: ['stock-movement.menu', 'product-inventory.menu'] },
          { label: 'Outlet Stock', href: '/products/outlet-stock', permission: ['stock-movement.menu', 'product-inventory.menu'] },
          { label: 'Stok per Dimensi', href: '/products/product-inventory/by-dimension', permission: 'product-inventory.menu' },
          { label: 'Stock Opnames', href: '/products/product-inventory/stock-opname', permission: ['stock-opname.menu', 'product-inventory.menu'] },
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
          { label: 'Incoming PO Requests', href: '/purchase/requested-orders', permission: 'purchase-order.menu' },
          { label: 'PO Payments', href: '/purchase/po-payments', permission: 'payment.menu' },
        ],
      },
      {
        label: 'Transfers',
        icon: ArrowLeftRight,
        children: [
          { label: 'Deliveries', href: '/transfer/deliveries', permission: 'delivery.menu' },
          { label: 'Receipts', href: '/transfer/receipts', permission: 'receipt.menu' },
          { label: 'Stock Transfers', href: '/transfer/stock-transfer', permission: 'delivery.menu' },
          { label: 'Dimension Transfers', href: '/transfer/dimension-transfer', permission: 'stock-movement.menu' },
          { label: 'Dimension Requests', href: '/transfer/dimension-transfer-requests', permission: 'dimension-transfer-request.menu' },
        ],
      },
      {
        label: 'Vendors',
        icon: Handshake,
        children: [
          { label: 'Suppliers', href: '/purchase/suppliers', permission: 'supplier.menu' },
          { label: 'Buyers', href: '/purchase/buyers', permission: 'buyer.menu' },
        ],
      },
    ],
  },
  {
    title: 'SALES',
    items: [
      { label: 'Sales Orders', href: '/sales/sales-orders', icon: ReceiptText, permission: 'sales-order.menu' },
      { label: 'Unpaid Orders', href: '/sales/unpaid-offline-orders', icon: Hourglass, permission: 'sales-order.menu' },
      { label: 'Payments', href: '/sales/payments', icon: Wallet, permission: 'payment.menu' },
      {
        label: 'Payment Settlements',
        icon: Banknote,
        children: [
          { label: 'Offline Orders', href: '/sales/payment-settlements', permission: 'payment.menu', channel: 'offline' },
          { label: 'Online Orders', href: '/sales/settle-payout', permission: 'sales-order.menu', channel: 'online' },
        ],
      },
      {
        label: 'Sales Setup',
        icon: Settings2,
        children: [
          { label: 'Sales Channels', href: '/sales/sales-channels', permission: 'sales-channel.menu' },
          { label: 'Customers', href: '/sales/customers', permission: 'customer.menu' },
          { label: 'Vouchers', href: '/sales/vouchers', permission: 'voucher.menu' },
          { label: 'Payment Methods', href: '/settings/payment-methods', permission: 'payment-method.menu' },
        ],
      },
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
        label: 'Transactions',
        icon: Landmark,
        children: [
          { label: 'Journals', href: '/accounting/journals', permission: 'journal.menu' },
          { label: 'Cash Transactions', href: '/accounting/cash-transactions', permission: 'cash-transaction.menu' },
          { label: 'Budgets', href: '/accounting/budgets', permission: 'budget.menu' },
        ],
      },
      {
        label: 'Financial Reports',
        icon: Scale,
        children: [
          { label: 'Trial Balance', href: '/accounting/reports/trial-balance', permission: 'journal.menu' },
          { label: 'Income Statement', href: '/accounting/reports/income-statement', permission: 'journal.menu' },
          { label: 'Balance Sheet', href: '/accounting/reports/balance-sheet', permission: 'journal.menu' },
          { label: 'Cash Flow', href: '/accounting/reports/cash-flow', permission: 'report.menu' },
          { label: 'General Ledger', href: '/accounting/reports/general-ledger', permission: 'report.menu' },
          { label: 'Journal Entries', href: '/accounting/reports/journal-entries', permission: 'report.menu' },
          { label: 'Comparative Reports', href: '/accounting/reports/comparative', permission: 'report.menu' },
          { label: 'Budget vs Actual', href: '/accounting/reports/budget-vs-actual', permission: 'report.menu' },
          { label: 'Tax Report', href: '/accounting/reports/tax-report', permission: 'report.menu' },
        ],
      },
      {
        label: 'AR & AP',
        icon: HandCoins,
        children: [
          { label: 'AR Aging', href: '/accounting/reports/ar-aging', permission: 'report.menu' },
          { label: 'AP Aging', href: '/accounting/reports/ap-aging', permission: 'journal.menu' },
          { label: 'Customer Statements', href: '/accounting/reports/customer-statements', permission: 'report.menu' },
          { label: 'Supplier Statements', href: '/accounting/reports/supplier-statements', permission: 'report.menu' },
          { label: 'Kartu Hutang Supplier', href: '/accounting/reports/supplier-debts', permission: 'report.menu' },
          { label: 'Payments Report', href: '/accounting/reports/payments-report', permission: 'report.menu' },
        ],
      },
      {
        label: 'Master Data',
        icon: Calculator,
        children: [
          { label: 'Chart of Accounts', href: '/accounting/chart-of-accounts', permission: 'chart-of-account.menu' },
          { label: 'Account Categories', href: '/accounting/account-categories', permission: 'account-category.menu' },
          { label: 'Account Types', href: '/accounting/account-types', permission: 'account-type.menu' },
          { label: 'Bank Accounts', href: '/accounting/bank-accounts', permission: 'bank-account.menu' },
          { label: 'Taxes', href: '/accounting/taxes', permission: 'tax.menu' },
          { label: 'Fiscal Years', href: '/accounting/fiscal-years', permission: 'fiscal-year.menu' },
          { label: 'Periods', href: '/accounting/periods', permission: 'period.menu' },
        ],
      },
      {
        label: 'Account Settings',
        icon: SlidersHorizontal,
        children: [
          { label: 'Account Settings', href: '/accounting/account-settings', permission: 'account-setting.menu' },
          { label: 'Branch Account Settings', href: '/accounting/branch-account-settings', permission: 'branch-account-setting.menu' },
          { label: 'Buyer Account Settings', href: '/accounting/buyer-account-settings', permission: 'buyer-account-setting.menu' },
          { label: 'Product Category Account Settings', href: '/accounting/product-category-account-settings', permission: 'product-category-account-setting.menu' },
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
          { label: 'Discounts & Vouchers', href: '/reports/discount-voucher', permission: 'sales-order.menu' },
          { label: 'Stock Position', href: '/reports/stock-position', permission: 'product-inventory.menu' },
          { label: 'Purchasing Reports', href: '/reports/purchasing', permission: 'report.menu' },
        ],
      },
    ],
  },
  {
    title: 'USERS',
    items: [
      { label: 'Users', href: '/users', icon: Users, permission: 'user.menu' },
      { label: 'Roles', href: '/users/roles', icon: UserCog, permission: 'role.menu' },
      { label: 'Permissions', href: '/users/permissions', icon: ShieldCheck, permission: 'permission.menu' },
    ],
  },
  {
    title: 'COMPANIES',
    items: [
      {
        label: 'Company',
        icon: Building2,
        children: [
          { label: 'Company', href: '/users/companies', permission: 'company.menu' },
          { label: 'Company Setting', href: '/settings/company-settings', permission: 'company-setting.menu' },
        ],
      },
      { label: 'Branches', href: '/users/branches', icon: GitBranch, permission: 'branch.menu' },
      { label: 'Departments', href: '/settings/departments', icon: Network, permission: 'department.menu' },
      { label: 'Employees', href: '/settings/employees', icon: UserCheck, permission: 'user.menu' },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { label: 'Audit Logs', href: '/settings/audit-logs', icon: BookOpen, permission: 'audit-log.menu' },
    ],
  },
];

type AppSidebarProps = {
  // Phones: the sidebar is an off-canvas drawer opened from the top bar.
  mobileOpen?: boolean;
};

export default function AppSidebar({ mobileOpen = false }: AppSidebarProps = {}) {
  const router = useRouter();
  const { hasPermission, isSuperadmin } = useAuth();
  const activeProductTypes = useActiveBranchProductTypes();
  const allowedProductTypes = activeProductTypes
    ? activeProductTypes.split(',').map((s) => s.trim().toLowerCase())
    : null;
  const [collapsedPref, setCollapsedPref] = useState(false);
  const [isPhone, setIsPhone] = useState(false);

  // Phone widths render the sidebar as a full drawer, never the icon rail.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsPhone(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const collapsed = collapsedPref && !isPhone;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // The glow hint (ui-v2.css, ::before layer) is centred on --glow-y: keep it
  // on the active menu item (the deepest active entry, a sub-item over its
  // group). Same item → follow it instantly (scroll, resize, group toggles);
  // a different item → fade out, move while invisible, fade back in.
  const asideRef = useRef<HTMLElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const glowTargetRef = useRef<HTMLElement | null>(null);
  const glowSwapTimer = useRef<number | undefined>(undefined);
  const placeGlow = useCallback(() => {
    const aside = asideRef.current;
    if (!aside) return;
    const actives = aside.querySelectorAll<HTMLElement>('.nav-item[data-active="true"]');
    const target = actives[actives.length - 1];
    // No active item yet (menu/permissions still loading, or a page without a
    // menu entry): no glow at all.
    if (!target) {
      glowTargetRef.current = null;
      delete aside.dataset.glowReady;
      return;
    }
    const centreOf = (el: HTMLElement) =>
      `${Math.round(el.getBoundingClientRect().top - aside.getBoundingClientRect().top + el.offsetHeight / 2)}px`;

    const moved = glowTargetRef.current !== null && glowTargetRef.current !== target;
    glowTargetRef.current = target;
    if (moved && 'glowReady' in aside.dataset) {
      aside.dataset.glowHidden = '';
      window.clearTimeout(glowSwapTimer.current);
      glowSwapTimer.current = window.setTimeout(() => {
        const current = glowTargetRef.current;
        if (current) aside.style.setProperty('--glow-y', centreOf(current));
        delete aside.dataset.glowHidden;
      }, 220);
      return;
    }
    if (!('glowHidden' in aside.dataset)) aside.style.setProperty('--glow-y', centreOf(target));
    aside.dataset.glowReady = '';
  }, []);
  const onNavScroll = placeGlow;

  // Keep the active menu in view: after a refresh (or opening a page by URL)
  // the menu list starts at the top, so scroll the active item into the middle
  // once it has rendered (items wait for the user's permissions). Once per
  // page, and only when it is out of view, so clicking a visible item never
  // jumps the list.
  const scrolledForPath = useRef<string | null>(null);
  useEffect(() => {
    const path = router.asPath;
    if (scrolledForPath.current === path) return;
    const scroller = navScrollRef.current;
    if (!scroller) return;
    const actives = scroller.querySelectorAll<HTMLElement>('.nav-item[data-active="true"]');
    const target = actives[actives.length - 1];
    if (!target) return;
    scrolledForPath.current = path;

    const box = scroller.getBoundingClientRect();
    const item = target.getBoundingClientRect();
    if (item.top >= box.top && item.bottom <= box.bottom) return;
    scroller.scrollTop += item.top - box.top - (box.height - item.height) / 2;
    placeGlow();
  });

  const isItemVisible = (item: NavItem): boolean => {
    if (item.hidden) return false;
    if (isSuperadmin) return true;
    if (!item.permission) return true;
    if (Array.isArray(item.permission)) {
      return item.permission.some((p) => hasPermission(p));
    }
    return hasPermission(item.permission);
  };

  const isChildAllowedByProductType = (href: string): boolean => {
    if (!allowedProductTypes) return true;
    if (href.includes('/products/product-inventory?type=') || href.includes('stock-movements?product_types=')) {
      const typeParam = /[?&](?:type|product_types)=([^&]+)/.exec(href)?.[1]?.toLowerCase();
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
      .filter((child) => !child.hidden)
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

  useEffect(() => {
    // After the DOM settles (group open/close, collapse width transition).
    const raf = requestAnimationFrame(placeGlow);
    const late = window.setTimeout(placeGlow, 220);
    window.addEventListener('resize', placeGlow);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      window.removeEventListener('resize', placeGlow);
    };
  }, [placeGlow, router.asPath, openGroups, collapsed, mobileOpen]);

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
      ref={asideRef}
      className="app-sidebar"
      data-mobile-open={mobileOpen}
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
        className="sidebar-head"
        style={{
          padding: '16px 12px',
          borderBottom: '1px solid var(--sidebar-border)',
        }}
      >
        {/* v2 brand lockup — only shown on routes using the v2 design (ui-v2.css). */}
        <div className="sidebar-brand-v2" data-collapsed={collapsed}>
          <img src="/icon-dapcok.png" alt="Dapur Cokelat" width={30} height={33} />
          {!collapsed && (
            <span className="sidebar-brand-v2-text">
              <span>DAPUR COKELAT</span>
              <span>EST. 2001</span>
            </span>
          )}
        </div>
        {collapsed ? (
          <div
            className="sidebar-brand-legacy"
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
          <div className="sidebar-brand-legacy">
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
      <div ref={navScrollRef} onScroll={onNavScroll} style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
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
            <div key={group.title} data-nav-group={group.title}>
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
                      className="nav-item"
                      data-active={active}
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
                      className="nav-item"
                      data-active={anyChildActive}
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
                              className="nav-item"
                              data-active={childActive}
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
                              {child.channel ? (() => {
                                const meta = CHANNEL_META[child.channel];
                                const ChannelIcon = meta.icon;
                                return (
                                  <>
                                    <ChannelIcon size={13} style={{ color: meta.color, flexShrink: 0, marginLeft: -4 }} />
                                    <span>
                                      <span style={{ color: meta.color, fontWeight: 600 }}>{meta.word}</span>
                                      {child.label.slice(meta.word.length)}
                                    </span>
                                  </>
                                );
                              })() : (
                                <>
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
                                </>
                              )}
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
        className="app-sidebar-collapse"
        style={{
          borderTop: '1px solid var(--sidebar-border)',
          padding: '12px 8px',
        }}
      >
        <button
          onClick={() => setCollapsedPref(!collapsedPref)}
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
