import { GlobalLayout } from "@/components/global-layout";
import Uoms from "@/views/Uoms";

const UomPage = () => {
  return (
    <GlobalLayout name="UOMS" breadcrumb={["Products", "UOMS"]}>
      <Uoms />
    </GlobalLayout>
  );
};

export default UomPage;
