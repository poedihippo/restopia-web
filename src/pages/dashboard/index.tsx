import React from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';

// One Dashboard menu: the view follows the active branch's type. Each view is
// loaded on demand so a branch only downloads its own dashboard.
const OutletDashboardView = dynamic(() => import('@/views/Dashboard'), { ssr: false });
const ProductionDashboardView = dynamic(() => import('@/views/ProductionDashboard'), { ssr: false });
const WarehouseDashboardView = dynamic(() => import('@/views/WarehouseDashboard'), { ssr: false });

export default function DashboardPage() {
  const { user } = useAuth();
  const branchType = String((user as any)?.branch?.type ?? '').toLowerCase();

  if (branchType === 'production') return <ProductionDashboardView />;
  if (branchType === 'warehouse') return <WarehouseDashboardView />;
  return <OutletDashboardView />;
}
