import useGetPurchaseOrder from '@/hooks/purchase-order/useGetPurchaseOrder';

interface Props {
    id: number
}

const usePurchaseOrderDetail = ({ id }: Props) => {
    const { data, isLoading } = useGetPurchaseOrder(id, {
        include: "created_by,updated_by,branch,supplier,supplier_branch,media,purchase_order_details",
    });

    return {
        data,
        isLoading,
    }
}

export default usePurchaseOrderDetail
