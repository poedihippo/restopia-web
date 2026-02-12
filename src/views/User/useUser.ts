import useDataTable from "@/hooks/useDataTable";
import useGetUserList from "@/hooks/user/useGetUserList";
import { useMemo } from "react";
import { useCreateUserModal } from "./Modal/useCreateUserModal";
import { useDeleteUserModal } from "./Modal/useDeleteUserModal";
import { useEditUserModal } from "./Modal/useEditUserModal";

const useUser = () => {
  //   const [branchId, setBranchId] = useState<number>();

  //   const extraParams = useMemo(
  //     () => ({
  //       "filter[branch_id]": branchId,
  //     }),
  //     [branchId],
  //   );

  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handlePerPageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id" });

  const { data: usersData, isLoading, refetch } = useGetUserList(queryParams);
  const users = useMemo(() => usersData?.data ?? [], [usersData?.data]);
  const pagination = useMemo(
    () => buildPagination(usersData?.meta),
    [buildPagination, usersData?.meta],
  );

  const editModal = useEditUserModal(refetch);
  const createModal = useCreateUserModal(refetch);
  const deleteModal = useDeleteUserModal(refetch);

  //   const handleBranchChange = useCallback((id?: number) => {
  //     setBranchId(id);
  //   }, []);

  return {
    users,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handlePerPageChange,
    handleSearch,

    //Modal,
    editModal,
    createModal,
    deleteModal,
  };
};

export default useUser;
