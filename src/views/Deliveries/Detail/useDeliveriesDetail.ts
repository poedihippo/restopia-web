import useGetDeliveries from '@/hooks/deliveries/useGetDeliveries';

interface Props {
    id: number
}

const useDeliveriesDetail = ({ id }: Props) => {
    const { data, isLoading } = useGetDeliveries(id, {
        include: "created_by,updated_by,branch,target_branch,purchase_order,media,delivery_details",
    });

    return {
        data,
        isLoading,
    }
}

export default useDeliveriesDetail
