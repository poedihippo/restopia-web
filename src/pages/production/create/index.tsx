import { GlobalLayout } from "@/components/global-layout";
import ProductionForm from "@/views/Productions/Form/ProductionForm";

const ProductionCreatePage = () => {
  return (
    <GlobalLayout
      name="Production Create"
      breadcrumb={["Production", "Create"]}
    >
      <ProductionForm />
    </GlobalLayout>
  );
};

export default ProductionCreatePage;
