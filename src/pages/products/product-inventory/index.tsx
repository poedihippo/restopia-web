import { GlobalLayout } from "@/components/global-layout";
import ProductInventories from "@/views/ProductInventories";

const ProductInventoryPage = () => {
  return (
    <GlobalLayout
      name="Product Inventory"
      breadcrumb={["Products", "Product Inventory"]}
    >
      <ProductInventories />
    </GlobalLayout>
  );
};

export default ProductInventoryPage;
