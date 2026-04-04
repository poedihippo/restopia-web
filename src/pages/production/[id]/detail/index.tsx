import ProductionDetail from '@/views/Productions/ProductionDetail'
import { useRouter } from "next/router";

const ProductionDetailPage = () => {
    const router = useRouter();
    const id = router.query.id;
    return <ProductionDetail id={Number(id)} />;
};

export default ProductionDetailPage;
