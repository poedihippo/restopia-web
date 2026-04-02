import DeliveriesDetail from "@/views/Deliveries/Detail/DeliveriesDetail";
import { useRouter } from "next/router";

const DeliveriesDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return <DeliveriesDetail id={Number(id)} />;
};

export default DeliveriesDetailPage;
