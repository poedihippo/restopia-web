import useGetSalesOrder from '@/hooks/sales-orders/useGetSalesOrder';

interface Props {
    id: number
}

const useSalesOrdersDetail = ({ id }: Props) => {
    const { data, isLoading } = useGetSalesOrder(id, {
        include:
            'branch,customer,sales_order_details,sales_order_details.product_inventory,sales_order_details.product_inventory.product_uom,sales_order_details.product_inventory.product_uom.product',
    });

    return {
        data,
        isLoading,
    }
}

export default useSalesOrdersDetail
