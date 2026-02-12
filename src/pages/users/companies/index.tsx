import { GlobalLayout } from "@/components/global-layout";
import Companies from "@/views/Companies";

const CompaniesPage = () => {
  return (
    <GlobalLayout name="Companies" breadcrumb={["Users", "Companies"]}>
      <Companies />
    </GlobalLayout>
  );
};

export default CompaniesPage;
