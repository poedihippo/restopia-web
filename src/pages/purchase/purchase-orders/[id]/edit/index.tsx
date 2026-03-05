import { GlobalLayout } from "@/components/global-layout";
import PurchaseOrdersEditForm from "@/views/PurchaseOrders/Form/PurchaseOrdersEditForm";
import { useRouter } from "next/router";

const PurchaseOrdersEdit = () => {
  const router = useRouter();
  const id = router.query.id;
  return (
    <GlobalLayout
      name="Purchase Order Edit"
      breadcrumb={["Purchase", "Purchase Orders", "Edit"]}
    >
      <PurchaseOrdersEditForm id={Number(id)} />
    </GlobalLayout>
  );
};

export default PurchaseOrdersEdit;
