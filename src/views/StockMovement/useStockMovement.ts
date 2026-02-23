import useGetBranchList from "@/hooks/branches/useGetBranchList";
import useGetProductInventoriesList from "@/hooks/product-inventories/useGetProductInventoriesList";
import useGetStockMovementList from "@/hooks/stock-movements/useGetStockMovementList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";

const useStockMovement = () => {
  const [branchId, setBranchId] = useState<number | null>();
  const [productInventoryId, setProductInventoryId] = useState<number | null>();
  const [direction, setDirection] = useState<string | null>();
  const [referenceType, setReferenceType] = useState<string | null>();

  const extraParams = useMemo(() => {
    const filter: Record<string, unknown> = {
      branch_id: branchId,
      product_inventory_id: productInventoryId,
      direction: direction,
      reference_type: referenceType,
    };

    const activeFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v != "all"),
    );

    return {
      include: "created_by,branch,product_inventory",
      ...(Object.keys(activeFilter).length > 0 ? { filter: activeFilter } : {}),
    };
  }, [branchId, productInventoryId, direction, referenceType]);

  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } = useGetStockMovementList(queryParams);
  const { data: productData, isLoading: isLoadingProduct } =
    useGetProductInventoriesList({
      include: "created_by,updated_by,branch,product_uom",
    });
  const { data: branchData, isLoading: isLoadingBranch } = useGetBranchList();

  const stockMovements = useMemo(() => data?.data ?? [], [data?.data]);
  const products = useMemo(() => productData?.data ?? [], [productData?.data]);
  const branches = useMemo(() => branchData?.data ?? [], [branchData?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const handleBranchChange = useCallback((id?: number) => {
    setBranchId(id);
  }, []);

  const handleProductInventoriesChange = useCallback((id?: number) => {
    setProductInventoryId(id);
  }, []);

  return {
    stockMovements,
    products,
    branches,
    pagination,
    search,
    isLoading,
    isLoadingProduct,
    isLoadingBranch,
    setDirection,
    setReferenceType,
    handlePageChange,
    handleSearch,
    handleBranchChange,
    handleProductInventoriesChange,
  };
};

export default useStockMovement;
