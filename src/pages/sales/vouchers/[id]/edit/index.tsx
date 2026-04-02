import VoucherFormEdit from "@/views/Voucher/Form/VoucherFormEdit";
import { useRouter } from "next/router";

const VoucherEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return <VoucherFormEdit id={Number(id)} />;
};

export default VoucherEditPage;
