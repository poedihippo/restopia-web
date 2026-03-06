import { GlobalLayout } from "@/components/global-layout";
import DeliveriesDetail from "@/views/Deliveries/Detail/DeliveriesDetail";
import { useRouter } from "next/router";

const DeliveriesDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return (
        <GlobalLayout name="Deliveries Detail"
            breadcrumb={["Transfer", "Deliveries", "Detail"]}>
            <DeliveriesDetail id={Number(id)} />
        </GlobalLayout>
    );
};

export default DeliveriesDetailPage;
