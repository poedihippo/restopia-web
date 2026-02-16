import { GlobalLayout } from "@/components/global-layout";
import Product from "@/views/Product";

const ProductPage = () => {
  return (
    <GlobalLayout name="Products" breadcrumb={["Products"]}>
      <Product />
    </GlobalLayout>
  );
};

export default ProductPage;
