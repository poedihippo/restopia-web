import dynamic from 'next/dynamic';

const SalesOrderEdit = dynamic(
  () => import('@/views/SalesOrders/SalesOrderEdit'),
  { ssr: false }
);

export default function SalesOrderEditPage() {
  return <SalesOrderEdit />;
}
