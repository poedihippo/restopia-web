import VoucherDetail from "@/views/Voucher/Detail/VoucherDetail";
import { useRouter } from "next/router";

const VoucherDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return <VoucherDetail id={Number(id)} />;
};

export default VoucherDetailPage;
