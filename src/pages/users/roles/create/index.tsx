import { GlobalLayout } from "@/components/global-layout";
import CreateRoles from "@/views/Roles/CreateRoles";

const RolesCreatePage = () => {
  return (
    <GlobalLayout name="Roles" breadcrumb={["Users", "Roles", "Create"]}>
      <CreateRoles />
    </GlobalLayout>
  );
};

export default RolesCreatePage;
