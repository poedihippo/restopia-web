import { GlobalLayout } from "@/components/global-layout";
import SalesOrders from "@/views/SalesOrders";

const SalesOrderPage = () => {
  return (
    <GlobalLayout name="Sales Orders" breadcrumb={["Sales", "Sales Orders"]}>
      <SalesOrders />
    </GlobalLayout>
  );
};

export default SalesOrderPage;
