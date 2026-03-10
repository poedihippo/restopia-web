import { GlobalLayout } from "@/components/global-layout";
import VoucherDetail from "@/views/Voucher/Detail/VoucherDetail";
import { useRouter } from "next/router";

const VoucherDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return (
        <GlobalLayout name="Vouchers Detail"
            breadcrumb={["Transfer", "Vouchers", "Detail"]}>
            <VoucherDetail id={Number(id)} />
        </GlobalLayout>
    );
};

export default VoucherDetailPage;
