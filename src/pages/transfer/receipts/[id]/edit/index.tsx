import { GlobalLayout } from "@/components/global-layout";
import ReceiptsFormEdit from "@/views/Receipts/Form/ReceiptsFormEdit";
import { useRouter } from "next/router";

const ReceiptsEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return (
    <GlobalLayout
      name="Receipts Edit"
      breadcrumb={["Transfer", "Receipts", "Edit"]}
    >
      <ReceiptsFormEdit id={Number(id)} />
    </GlobalLayout>
  );
};

export default ReceiptsEditPage;
