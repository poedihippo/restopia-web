import useGetBranchList from "@/hooks/branches/useGetBranchList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useEditBranchModal } from "./Modal/useEditBranchModal";
import { useCreateBranchModal } from "./Modal/useCreateBranchModal";
import { useDeleteBranchModal } from "./Modal/useDeleteBranchModal";
import useGetCompaniesList from "@/hooks/companies/useGetCompaniesList";

const useBranches = () => {
  const [companyId, setCompanyId] = useState<number>();

  const extraParams = useMemo(
    () => ({
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

  const { data, isLoading, refetch } = useGetBranchList(queryParams);
  const { data: companyData, isLoading: isLoadingCompany } =
    useGetCompaniesList();

  const branches = useMemo(() => data?.data ?? [], [data?.data]);
  const company = useMemo(() => companyData?.data ?? [], [companyData?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const editModal = useEditBranchModal(refetch);
  const createModal = useCreateBranchModal(refetch);
  const deleteModal = useDeleteBranchModal(refetch);

  const handleCompanyChange = useCallback((id?: number) => {
    setCompanyId(id);
  }, []);

  return {
    branches,
    company,
    search,
    isLoadingCompany,
    pagination,
    isLoading,
    handlePageChange,
    handleSearch,
    handleCompanyChange,

    //Modal
    editModal,
    createModal,
    deleteModal,
  };
};

export default useBranches;
