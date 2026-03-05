import { GlobalLayout } from "@/components/global-layout";
import Suppliers from "@/views/Suppliers";

const SuppliersPage = () => {
  return (
    <GlobalLayout name="Suppliers" breadcrumb={["Suppliers"]}>
      <Suppliers />
    </GlobalLayout>
  );
};

export default SuppliersPage;
