import { GlobalLayout } from "@/components/global-layout";
import VoucherFormEdit from "@/views/Voucher/Form/VoucherFormEdit";
import { useRouter } from "next/router";

const VoucherEditPage = () => {
  const router = useRouter();
  const id = router.query.id;
  return (
    <GlobalLayout
      name="Vouchers Edit"
      breadcrumb={["Sales", "Vouchers", "Edit"]}
    >
      <VoucherFormEdit id={Number(id)} />
    </GlobalLayout>
  );
};

export default VoucherEditPage;
