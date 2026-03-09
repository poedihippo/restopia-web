import { GlobalLayout } from "@/components/global-layout";
import ReceiptsDetail from "@/views/Receipts/Detail/ReceiptsDetail";
import { useRouter } from "next/router";

const ReceiptsDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return (
        <GlobalLayout name="Receipts Detail"
            breadcrumb={["Transfer", "Receipts", "Detail"]}>
            <ReceiptsDetail id={Number(id)} />
        </GlobalLayout>
    );
};

export default ReceiptsDetailPage;
