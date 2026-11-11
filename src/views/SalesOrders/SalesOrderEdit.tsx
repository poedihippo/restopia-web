'use client';

import { useRouter } from 'next/router';
import { useQuery } from '@tanstack/react-query';
import { salesOrdersService as salesOrderService } from '@/services/sales-orders.service';
import SalesOrderForm from './SalesOrderForm';
import BackLink from '@/components/BackLink';

export default function SalesOrderEdit() {
  const router = useRouter();
  const id = Number(router.query.id);

  const { data, isLoading } = useQuery({
    queryKey: ['sales-order-edit', id],
    enabled: router.isReady && !!id && Number.isFinite(id),
    queryFn: () =>
      salesOrderService
        .findById(id, {
          include:
            'customer,purchase_order,additional_charges,credit_by,' +
            // sales_order_details carries sales_order_detail_bundles already (POS relies on it).
            'sales_order_details,sales_order_details.product_inventory,sales_order_details.bundle',
        })
        .then((r) => r.data),
  });

  const order = (data as any)?.data;

  if (!router.isReady || isLoading) return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)', color: 'var(--foreground-muted)' }}>
      Loading order...
    </div>
  );

  if (!order) return (
    <div style={{ padding: '32px 40px', fontFamily: 'var(--font-sans)', color: 'var(--foreground-muted)' }}>
      Order not found.{' '}
      <BackLink href="/sales/sales-orders" label="Sales Orders" />
    </div>
  );

  return <SalesOrderForm editingOrder={order} />;
}
