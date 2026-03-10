import { GlobalLayout } from "@/components/global-layout";
import Customer from "@/views/Customer";

const CustomersPage = () => {
  return (
    <GlobalLayout name="Customers" breadcrumb={["Sales", "Customers"]}>
      <Customer />
    </GlobalLayout>
  );
};

export default CustomersPage;
