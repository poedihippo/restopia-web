import { GlobalLayout } from "@/components/global-layout";
import SalesOrdersDetail from "@/views/SalesOrders/Detail/SalesOrdersDetail";
import { useRouter } from "next/router";

const SalesOrderDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return (
        <GlobalLayout name="Sales Orders Detail"
            breadcrumb={["Transfer", "Sales Orders", "Detail"]}>
            <SalesOrdersDetail id={Number(id)} />
        </GlobalLayout>
    );
};

export default SalesOrderDetailPage;
