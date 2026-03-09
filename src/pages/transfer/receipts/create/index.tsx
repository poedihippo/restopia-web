import { GlobalLayout } from "@/components/global-layout";
import ReceiptsForm from "@/views/Receipts/Form/ReceiptsForm";

const ReceiptsCreatePage = () => {
  return (
    <GlobalLayout
      name="Receipts Create"
      breadcrumb={["Transfer", "Receipts", "Create"]}
    >
      <ReceiptsForm />
    </GlobalLayout>
  );
};

export default ReceiptsCreatePage;
