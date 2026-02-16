import useGetUOMList from "@/hooks/uom/useGetUOMList";
import useDataTable from "@/hooks/useDataTable";
import { useMemo } from "react";
import { useCreateUomsModal } from "./Modal/useCreateUomsModal";
import { useDeleteUomsModal } from "./Modal/useDeleteUomsModal";
import { useEditUomsModal } from "./Modal/useEditUomsModal";

const useUoms = () => {
  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id" });

  const { data, isLoading, refetch } = useGetUOMList(queryParams);

  const uoms = useMemo(() => data?.data ?? [], [data?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

    const editModal = useEditUomsModal(refetch);
    const createModal = useCreateUomsModal(refetch);
    const deleteModal = useDeleteUomsModal(refetch);

  return {
    uoms,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,
    editModal,
    createModal,
    deleteModal,
  };
};

export default useUoms;
