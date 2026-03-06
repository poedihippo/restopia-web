import { GlobalLayout } from "@/components/global-layout";
import DeliveriesEditForm from "@/views/Deliveries/Form/DeliveriesEditForm";
import { useRouter } from "next/router";

const DeliveriesEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return (
    <GlobalLayout
      name="Deliveries Edit"
      breadcrumb={["Transfer", "Deliveries", "Edit"]}
    >
      <DeliveriesEditForm id={Number(id)} />
    </GlobalLayout>
  );
};

export default DeliveriesEditPage;
