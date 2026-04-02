import SalesOrdersFormEditPOS from "@/views/SalesOrders/Form/SalesOrdersFormEditPOS";
import { useRouter } from "next/router";

const SalesOrdersEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return <SalesOrdersFormEditPOS id={Number(id)} />;
};

export default SalesOrdersEditPage;
