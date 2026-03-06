import { GlobalLayout } from "@/components/global-layout";
import PurchaseOrderDetail from "@/views/PurchaseOrders/Detail/PurchaseOrderDetail";
import { useRouter } from "next/router";

const PurchaseOrderDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return (
        <GlobalLayout name="Purchase Order Detail"
            breadcrumb={["Purchase", "Purchase Orders", "Detail"]}>
            <PurchaseOrderDetail id={Number(id)} />
        </GlobalLayout>
    );
};

export default PurchaseOrderDetailPage;
