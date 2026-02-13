import useGetCompaniesList from "@/hooks/companies/useGetCompaniesList";
import useGetRoleList from "@/hooks/roles/useGetRoleList";
import useDataTable from "@/hooks/useDataTable";
import React, { useCallback, useMemo, useState } from "react";
import { useDeleteRolesModal } from "./Modal/useDeleteRolesModal";
import useDetailPermissionModal from "./Modal/useDetailPermissionModal";

const useRoles = () => {
  const [companyId, setCompanyId] = useState<number>();

  const extraParams = useMemo(
    () => ({
      include: "permissions",
      filter: {
        company_id: companyId,
      },
    }),
    [companyId],
  );
  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } = useGetRoleList(queryParams);
  const { data: companyData, isLoading: isLoadingCompany } =
    useGetCompaniesList();

  const roles = useMemo(() => data?.data ?? [], [data?.data]);
  const company = useMemo(() => companyData?.data ?? [], [companyData?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  //   const editModal = useEditBranchModal(refetch);
  //   const createModal = useCreateBranchModal(refetch);
  const deleteModal = useDeleteRolesModal(refetch);
  const detailPermissionModal = useDetailPermissionModal();

  const handleCompanyChange = useCallback((id?: number) => {
    setCompanyId(id);
  }, []);

  return {
    roles,
    company,
    search,
    isLoadingCompany,
    pagination,
    isLoading,
    handlePageChange,
    handleSearch,
    handleCompanyChange,

    //Modal
    // editModal,
    // createModal,
    deleteModal,
    detailPermissionModal,
  };
};

export default useRoles;
