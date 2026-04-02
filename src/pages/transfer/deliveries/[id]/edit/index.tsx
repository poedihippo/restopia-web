import DeliveriesEditForm from "@/views/Deliveries/Form/DeliveriesEditForm";
import { useRouter } from "next/router";

const DeliveriesEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return <DeliveriesEditForm id={Number(id)} />;
};

export default DeliveriesEditPage;
