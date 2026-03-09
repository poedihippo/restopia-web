import useGetReceipts from '@/hooks/receipts/useGetReceipts';

interface Props {
    id: number
}

const useReceiptsDetail = ({ id }: Props) => {
    const { data, isLoading } = useGetReceipts(id, {
        include: "created_by,updated_by,branch,delivery,media,receipt_details",
    });

    return {
        data,
        isLoading,
    }
}

export default useReceiptsDetail
