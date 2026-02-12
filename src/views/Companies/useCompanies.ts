import useGetCompaniesList from "@/hooks/companies/useGetCompaniesList";
import useDataTable from "@/hooks/useDataTable";
import { useMemo } from "react";
import { useEditCompaniesModal } from "./Modal/useEditCompaniesModal";
import { useCreateCompaniesModal } from "./Modal/useCreateCompaniesModal";
import { useDeleteCompaniesModal } from "./Modal/useDeleteCompaniesModal";

const useCompanies = () => {
  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id" });

  const { data, isLoading, refetch } = useGetCompaniesList(queryParams);
  const companies = useMemo(() => data?.data ?? [], [data?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const editModal = useEditCompaniesModal(refetch);
  const createModal = useCreateCompaniesModal(refetch);
  const deleteModal = useDeleteCompaniesModal(refetch);

  return {
    companies,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,

    //Modal
    editModal,
    createModal,
    deleteModal,
  };
};

export default useCompanies;
