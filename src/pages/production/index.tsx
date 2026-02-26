import { GlobalLayout } from "@/components/global-layout";
import Productions from "@/views/Productions";

const ProductionPage = () => {
  return (
    <GlobalLayout name="Productions" breadcrumb={["Productions"]}>
      <Productions />
    </GlobalLayout>
  );
};

export default ProductionPage;
