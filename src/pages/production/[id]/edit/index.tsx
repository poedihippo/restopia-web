import { GlobalLayout } from "@/components/global-layout";
import ProductionEditForm from "@/views/Productions/Form/ProductionEditForm";
import { useRouter } from "next/router";

const ProductionEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return (
    <GlobalLayout name="Production Edit" breadcrumb={["Production", "Edit"]}>
      <ProductionEditForm id={Number(id)} />
    </GlobalLayout>
  );
};

export default ProductionEditPage;
