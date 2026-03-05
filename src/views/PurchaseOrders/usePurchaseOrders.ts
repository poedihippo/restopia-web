import useGetBranchList from "@/hooks/branches/useGetBranchList";
import useGetPurchaseOrderList from "@/hooks/purchase-order/useGetPurchaseOrderList";
import useGetSupplierList from "@/hooks/suppliers/useGetSupplierList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useDeletePurchaseOrdersModal } from "./Form/useDeletePurchaseOrdersModal";

const usePurchaseOrders = () => {
  const [branchId, setBranchId] = useState<number | null>();
  const [supplierId, setSupplierId] = useState<number | null>();
  const [supplierBranchId, setSupplierBranchId] = useState<number | null>();
  const [status, setStatus] = useState<string | null>();
  const [startDate, setStartDate] = useState<string | null>();
  const [endDate, setEndDate] = useState<string | null>();
  const [filterKey, setFilterKey] = useState(0);

  const extraParams = useMemo(() => {
    const filter: Record<string, unknown> = {
      branch_id: branchId,
      supplier_id: supplierId,
      supplier_branch_id: supplierBranchId,
      status: status,
      date_gte: startDate,
      date_lte: endDate,
    };
    const activeFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v != null),
    );

    return {
      include: "created_by,updated_by,branch,media,production_details",
      ...(Object.keys(activeFilter).length > 0 ? { filter: activeFilter } : {}),
    };
  }, [branchId, startDate, status, endDate, supplierId, supplierBranchId]);

  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } = useGetPurchaseOrderList(queryParams);
  const { data: branchData, isLoading: isLoadingBranch } = useGetBranchList();
  const { data: supplierData, isLoading: isLoadingSupplier } = useGetSupplierList();

  const purchaseOrders = useMemo(() => data?.data ?? [], [data?.data]);
  const branches = useMemo(() => branchData?.data ?? [], [branchData?.data]);
  const suppliers = useMemo(() => supplierData?.data ?? [], [supplierData?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const deleteModal = useDeletePurchaseOrdersModal(refetch);

  const handleBranchChange = useCallback((id?: number) => {
    setBranchId(id);
  }, []);

  const handleSupplierChange = useCallback((id?: number) => {
    setSupplierId(id);
  }, []);

  const handleSupplierBranchChange = useCallback((id?: number) => {
    setSupplierBranchId(id);
  }, []);

  const handleClearFilter = useCallback(() => {
    setBranchId(null);
    setSupplierId(null);
    setSupplierBranchId(null);
    setStatus(null);
    setStartDate(null);
    setEndDate(null);
    setFilterKey((k) => k + 1);
  }, []);

  return {
    purchaseOrders,
    branches,
    suppliers,
    pagination,
    isLoading,
    search,
    isLoadingBranch,
    isLoadingSupplier,
    filterKey,
    setStartDate,
    setEndDate,
    setStatus,
    handleClearFilter,
    handleSupplierBranchChange,
    handleSupplierChange,
    handleBranchChange,
    handlePageChange,
    handleSearch,
    deleteModal,
  };
};

export default usePurchaseOrders;
