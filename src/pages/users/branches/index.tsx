import { GlobalLayout } from "@/components/global-layout";
import Branches from "@/views/Branches";

const BranchPage = () => {
  return (
    <GlobalLayout name="Branches" breadcrumb={["Users", "Branches"]}>
      <Branches />
    </GlobalLayout>
  );
};

export default BranchPage;
