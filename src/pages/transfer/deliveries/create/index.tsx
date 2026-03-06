import { GlobalLayout } from "@/components/global-layout";
import DeliveriesForm from "@/views/Deliveries/Form/DeliveriesForm";

const DeliveriesCreatePage = () => {
  return (
    <GlobalLayout
      name="Deliveries Create"
      breadcrumb={["Transfer", "Deliveries", "Create"]}
    >
      <DeliveriesForm />
    </GlobalLayout>
  );
};

export default DeliveriesCreatePage;
