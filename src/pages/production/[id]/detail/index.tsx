import { GlobalLayout } from "@/components/global-layout";
import ProductionDetail from "@/views/Productions/Details/ProductionDetail";
import { useRouter } from "next/router";

const ProductionDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return (
        <GlobalLayout name="Production Detail" breadcrumb={["Production", "Detail"]}>
            <ProductionDetail id={Number(id)} />
        </GlobalLayout>
    );
};

export default ProductionDetailPage;
