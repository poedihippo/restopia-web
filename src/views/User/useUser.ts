import useDataTable from "@/hooks/useDataTable";
import useGetBranchList from "@/hooks/branches/useGetBranchList";
import useGetUserList from "@/hooks/user/useGetUserList";
import { useCallback, useMemo, useState } from "react";
import { useCreateUserModal } from "./Modal/useCreateUserModal";
import { useDeleteUserModal } from "./Modal/useDeleteUserModal";
import { useEditUserModal } from "./Modal/useEditUserModal";

const useUser = () => {
  const [branchId, setBranchId] = useState<number>();

  const extraParams = useMemo(
    () => ({
      filter: {
        branch_id: branchId,
      },
    }),
    [branchId],
  );

  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data: usersData, isLoading, refetch } = useGetUserList(queryParams);
  const { data: branchData, isLoading: isLoadingBranch } = useGetBranchList();

  const users = useMemo(() => usersData?.data ?? [], [usersData?.data]);
  const branches = useMemo(() => branchData?.data ?? [], [branchData?.data]);

  const pagination = useMemo(
    () => buildPagination(usersData?.meta),
    [buildPagination, usersData?.meta],
  );

  const editModal = useEditUserModal(refetch);
  const createModal = useCreateUserModal(refetch);
  const deleteModal = useDeleteUserModal(refetch);

  const handleBranchChange = useCallback((id?: number) => {
    setBranchId(id);
  }, []);

  return {
    users,
    branches,
    pagination,
    isLoading,
    isLoadingBranch,
    search,
    handlePageChange,
    handleSearch,
    handleBranchChange,

    //Modal,
    editModal,
    createModal,
    deleteModal,
  };
};

export default useUser;
