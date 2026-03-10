import { GlobalLayout } from "@/components/global-layout";
import SalesOrdersEditForm from "@/views/SalesOrders/Form/SalesOrdersEditForm";
import { useRouter } from "next/router";

const SalesOrdersEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return (
    <GlobalLayout
      name="Sales Orders Edit"
      breadcrumb={["Sales", "Sales Orders", "Edit"]}
    >
      <SalesOrdersEditForm id={Number(id)} />
    </GlobalLayout>
  );
};

export default SalesOrdersEditPage;
