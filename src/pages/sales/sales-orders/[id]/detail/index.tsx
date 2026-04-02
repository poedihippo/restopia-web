import SalesOrdersDetail from "@/views/SalesOrders/Detail/SalesOrdersDetail";
import { useRouter } from "next/router";

const SalesOrderDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return <SalesOrdersDetail id={Number(id)} />;
};

export default SalesOrderDetailPage;
