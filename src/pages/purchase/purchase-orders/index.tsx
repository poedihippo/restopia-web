import { GlobalLayout } from "@/components/global-layout";
import PurchaseOrders from "@/views/PurchaseOrders";

const PurchaseOrdersPage = () => {
  return (
    <GlobalLayout name="Purchase Orders" breadcrumb={["Purchase", "Purchase Orders"]}>
      <PurchaseOrders />
    </GlobalLayout>
  );
};

export default PurchaseOrdersPage;
