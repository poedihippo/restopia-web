import ProductionEditForm from "@/views/Productions/Form/ProductionEditForm";
import { useRouter } from "next/router";

const ProductionEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return <ProductionEditForm id={Number(id)} />;
};

export default ProductionEditPage;
