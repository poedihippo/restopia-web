import { GlobalLayout } from "@/components/global-layout";
import SalesOrdersFormPOS from "@/views/SalesOrders/Form/SalesOrdersFormPOS";

const SalesOrderCreatePage = () => {
  return (
    <GlobalLayout
      name="Sales Orders Create"
      breadcrumb={["Sales", "Sales Orders", "Create"]}
    >
      <SalesOrdersFormPOS />
    </GlobalLayout>
  );
};

export default SalesOrderCreatePage;
