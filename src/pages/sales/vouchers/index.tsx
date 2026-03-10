import { GlobalLayout } from "@/components/global-layout";
import Voucher from "@/views/Voucher";

const VouchersPage = () => {
  return (
    <GlobalLayout name="Vouchers" breadcrumb={["Sales", "Vouchers"]}>
      <Voucher />
    </GlobalLayout>
  );
};

export default VouchersPage;
