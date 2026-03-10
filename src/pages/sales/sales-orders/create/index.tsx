import { GlobalLayout } from "@/components/global-layout";
import SalesOrdersForm from "@/views/SalesOrders/Form/SalesOrdersForm";

const SalesOrderCreatePage = () => {
  return (
    <GlobalLayout
      name="Sales Orders Create"
      breadcrumb={["Sales", "Sales Orders", "Create"]}
    >
      <SalesOrdersForm />
    </GlobalLayout>
  );
};

export default SalesOrderCreatePage;
