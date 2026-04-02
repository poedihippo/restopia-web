import ReceiptsFormEdit from "@/views/Receipts/Form/ReceiptsFormEdit";
import { useRouter } from "next/router";

const ReceiptsEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return <ReceiptsFormEdit id={Number(id)} />;
};

export default ReceiptsEditPage;
