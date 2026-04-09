import useGetSalesOrder from '@/hooks/sales-orders/useGetSalesOrder';

interface Props {
    id: number
}

const useSalesOrdersDetail = ({ id }: Props) => {
    const { data, isLoading } = useGetSalesOrder(id, {
        include:
            'created_by,updated_by,branch,customer,media,sales_order_details,sales_order_details.product_inventory_snapshot,sales_order_details.product_inventory_snapshot.product_uom,sales_order_details.product_inventory_snapshot.product_uom.product,sales_order_details.bundle',
    });

    return {
        data,
        isLoading,
    }
}

export default useSalesOrdersDetail
