import { GlobalLayout } from "@/components/global-layout";
import VoucherForm from "@/views/Voucher/Form/VoucherForm";

const VoucherCreatePage = () => {
  return (
    <GlobalLayout
      name="Vouchers Create"
      breadcrumb={["Sales", "Vouchers", "Create"]}
    >
      <VoucherForm />
    </GlobalLayout>
  );
};

export default VoucherCreatePage;
