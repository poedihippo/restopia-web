import useGetBranchList from "@/hooks/branches/useGetBranchList";
import useGetProductionList from "@/hooks/productions/useGetProductionList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useDeleteProductionsModal } from "./Form/useDeleteProductionsModal";

const useProductions = () => {
  const [branchId, setBranchId] = useState<number | null>();
  const [status, setStatus] = useState<string | null>();
  const [startDate, setStartDate] = useState<string | null>();
  const [endDate, setEndDate] = useState<string | null>();
  const [filterKey, setFilterKey] = useState(0);

  const extraParams = useMemo(() => {
    const filter: Record<string, unknown> = {
      branch_id: branchId,
      status: status,
      start_date: startDate,
      end_date: endDate,
    };
    const activeFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v != null),
    );

    return {
      include: "created_by,updated_by,branch,media,production_details",
      ...(Object.keys(activeFilter).length > 0 ? { filter: activeFilter } : {}),
    };
  }, [branchId, startDate, status, endDate]);

  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } = useGetProductionList(queryParams);
  const { data: branchData, isLoading: isLoadingBranch } = useGetBranchList();
  const productions = useMemo(() => data?.data ?? [], [data?.data]);
  const branches = useMemo(() => branchData?.data ?? [], [branchData?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const deleteModal = useDeleteProductionsModal(refetch);

  const handleBranchChange = useCallback((id?: number) => {
    setBranchId(id);
  }, []);

  const handleClearFilter = useCallback(() => {
    setBranchId(null);
    setStatus(null);
    setStartDate(null);
    setEndDate(null);
    setFilterKey((k) => k + 1);
  }, []);

  return {
    productions,
    branches,
    pagination,
    isLoading,
    search,
    isLoadingBranch,
    filterKey,
    setStartDate,
    setEndDate,
    setStatus,
    handleClearFilter,
    handleBranchChange,
    handlePageChange,
    handleSearch,
    deleteModal,
  };
};

export default useProductions;
