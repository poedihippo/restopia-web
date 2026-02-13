import { GlobalLayout } from "@/components/global-layout";
import EditRoles from "@/views/Roles/EditRoles";

const RolesEditPage = () => {
  return (
    <GlobalLayout name="Roles" breadcrumb={["Users", "Roles", "Edit"]}>
      <EditRoles />
    </GlobalLayout>
  );
};

export default RolesEditPage;
