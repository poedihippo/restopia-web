import { GlobalLayout } from "@/components/global-layout";
import Deliveries from "@/views/Deliveries";

const DeliveriesPage = () => {
  return (
    <GlobalLayout name="Deliveries" breadcrumb={["Transfer", "Deliveries"]}>
      <Deliveries />
    </GlobalLayout>
  );
};

export default DeliveriesPage;
