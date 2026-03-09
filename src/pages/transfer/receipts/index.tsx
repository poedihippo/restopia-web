import { GlobalLayout } from "@/components/global-layout";
import Receipts from "@/views/Receipts";

const ReceiptsPage = () => {
  return (
    <GlobalLayout name="Receipts" breadcrumb={["Transfer", "Receipts"]}>
      <Receipts />
    </GlobalLayout>
  );
};

export default ReceiptsPage;
