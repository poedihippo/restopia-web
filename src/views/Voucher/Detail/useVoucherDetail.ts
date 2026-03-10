import useGetReceipts from '@/hooks/receipts/useGetReceipts';
import useGetVoucher from '@/hooks/voucher/useGetVoucher';

interface Props {
    id: number
}

const useVoucherDetail = ({ id }: Props) => {
    const { data, isLoading } = useGetVoucher(id, {
        include: "created_by,updated_by,voucher_branches,voucher_product_uoms",
    });

    return {
        data,
        isLoading,
    }
}

export default useVoucherDetail
