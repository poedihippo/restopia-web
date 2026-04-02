import PurchaseOrderDetail from "@/views/PurchaseOrders/Detail/PurchaseOrderDetail";
import { useRouter } from "next/router";

const PurchaseOrderDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return <PurchaseOrderDetail id={Number(id)} />;
};

export default PurchaseOrderDetailPage;
