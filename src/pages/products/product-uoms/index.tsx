import { GlobalLayout } from "@/components/global-layout";
import ProductUoms from "@/views/ProductUoms";

const ProductUomsPage = () => {
  return (
    <GlobalLayout name="Product Uoms" breadcrumb={["Products", "Product Uoms"]}>
      <ProductUoms />
    </GlobalLayout>
  );
};

export default ProductUomsPage;
