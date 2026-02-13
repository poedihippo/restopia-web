import { GlobalLayout } from "@/components/global-layout";
import Roles from "@/views/Roles";

const RolesPage = () => {
  return (
    <GlobalLayout name="Roles" breadcrumb={["Users", "Roles"]}>
      <Roles />
    </GlobalLayout>
  );
};

export default RolesPage;
