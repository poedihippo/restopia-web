import { GlobalLayout } from "@/components/global-layout";
import PurchaseOrdersForm from "@/views/PurchaseOrders/Form/PurchaseOrdersForm";

const PurchaseOrdersCreatePage = () => {
  return (
    <GlobalLayout
      name="Purchase Orders Create"
      breadcrumb={["Purchase", "Purchase Orders", "Create"]}
    >
      <PurchaseOrdersForm />
    </GlobalLayout>
  );
};

export default PurchaseOrdersCreatePage;
