import { GlobalLayout } from "@/components/global-layout";
import SalesOrdersFormEditPOS from "@/views/SalesOrders/Form/SalesOrdersFormEditPOS";
import { useRouter } from "next/router";

const SalesOrdersEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return (
    <GlobalLayout
      name="Sales Orders Edit"
      breadcrumb={["Sales", "Sales Orders", "Edit"]}
    >
      <SalesOrdersFormEditPOS id={Number(id)} />
    </GlobalLayout>
  );
};

export default SalesOrdersEditPage;
