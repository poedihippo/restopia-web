import PurchaseOrdersEditForm from "@/views/PurchaseOrders/Form/PurchaseOrdersEditForm";
import { useRouter } from "next/router";

const PurchaseOrdersEdit = () => {
  const router = useRouter();
  const id = router.query.id;
  return <PurchaseOrdersEditForm id={Number(id)} />;
};

export default PurchaseOrdersEdit;
