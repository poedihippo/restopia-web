import useGetSalesOrder from '@/hooks/sales-orders/useGetSalesOrder';

interface Props {
    id: number
}

const useSalesOrdersDetail = ({ id }: Props) => {
    const { data, isLoading } = useGetSalesOrder(id, {
        include:
            'branch,customer,sales_order_details',
    });

    return {
        data,
        isLoading,
    }
}

export default useSalesOrdersDetail
