import { GlobalLayout } from "@/components/global-layout";
import User from "@/views/User";

const UserPage = () => {
  return (
    <GlobalLayout name="Users" breadcrumb={["Users"]}>
      <User />
    </GlobalLayout>
  );
};

export default UserPage;
