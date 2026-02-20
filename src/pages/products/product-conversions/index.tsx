import { GlobalLayout } from "@/components/global-layout";
import ProductConversions from "@/views/ProductConversions";

const ProductConversionsPage = () => {
  return (
    <GlobalLayout
      name="Product Conversions"
      breadcrumb={["Products", "Product Conversions"]}
    >
      <ProductConversions />
    </GlobalLayout>
  );
};

export default ProductConversionsPage;
