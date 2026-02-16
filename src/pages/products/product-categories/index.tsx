import { GlobalLayout } from "@/components/global-layout";
import ProductCategories from "@/views/ProductCategories";

const ProductCategoriesPage = () => {
  return (
    <GlobalLayout name="Product Categories" breadcrumb={["Products", "Product Categories"]}>
      <ProductCategories />
    </GlobalLayout>
  );
};

export default ProductCategoriesPage;
