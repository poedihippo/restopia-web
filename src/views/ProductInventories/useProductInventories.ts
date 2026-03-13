import useGetBranchList from "@/hooks/branches/useGetBranchList";
import useGetProductInventoriesList from "@/hooks/product-inventories/useGetProductInventoriesList";
import useGetProductUomsList from "@/hooks/product-uoms/useGetProductUomsList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useCreateStockMovement } from "../StockMovement/Modal/useCreateStockMovement";
import { useCreateProductInventoriesModal } from "./Modal/useCreateProductInventoriesModal";
import { useDeleteProductInventoriesModal } from "./Modal/useDeleteProductInventoriesModal";
import { useEditProductInventoriesModal } from "./Modal/useEditProductInventoriesModal";

const useProductInventories = () => {
  const [productId, setProductId] = useState<number | null>();
  const [branchId, setBranchId] = useState<number | null>();
  const [isDefault, setIsDefault] = useState<number | null>();
  const [status, setStatus] = useState<string | null>();
  const [expiryDateGte, setExpiryDateGte] = useState<string | null>();
  const [expiryDateLte, setExpiryDateLte] = useState<string | null>();
  const [stockGte, setStockGte] = useState<number | null>();
  const [stockLte, setStockLte] = useState<number | null>();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [priceEditable, setPriceEditable] = useState<number | null>();
  const [basePriceGte, setBasePriceGte] = useState<number | null>();
  const [basePriceLte, setBasePriceLte] = useState<number | null>();
  const [onlinePriceGte, setOnlinePriceGte] = useState<number | null>();
  const [onlinePriceLte, setOnlinePriceLte] = useState<number | null>();
  const [filterKey, setFilterKey] = useState(0);

  const extraParams = useMemo(() => {
    const filter: Record<string, unknown> = {
      product_id: productId,
      branch_id: branchId,
      is_default: isDefault,
      price_editable: priceEditable,
      base_price_qte: basePriceGte,
      base_price_lte: basePriceLte,
      online_price_qte: onlinePriceGte,
      online_price_lte: onlinePriceLte,
      status: status,
      expiry_date_gte: expiryDateGte,
      expiry_date_lte: expiryDateLte,
      stock_gte: stockGte,
      stock_lte: stockLte,
    };

    const activeFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v != null),
    );

    return {
      include: "created_by,updated_by,branch,product_uom",
      ...(Object.keys(activeFilter).length > 0 ? { filter: activeFilter } : {}),
    };
  }, [
    productId,
    branchId,
    isDefault,
    basePriceGte,
    basePriceLte,
    priceEditable,
    onlinePriceGte,
    onlinePriceLte,
    status,
    expiryDateGte,
    expiryDateLte,
    stockGte,
    stockLte,
  ]);

  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } =
    useGetProductInventoriesList(queryParams);
  const { data: productData, isLoading: isLoadingProduct } =
    useGetProductUomsList({
      include: "created_by,updated_by,product,uom",
    });
  const { data: branchData, isLoading: isLoadingBranch } = useGetBranchList();

  const productInventories = useMemo(() => data?.data ?? [], [data?.data]);
  const products = useMemo(() => productData?.data ?? [], [productData?.data]);
  const branches = useMemo(() => branchData?.data ?? [], [branchData?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const editModal = useEditProductInventoriesModal(refetch);
  const createModal = useCreateProductInventoriesModal(refetch);
  const deleteModal = useDeleteProductInventoriesModal(refetch);
  const createStockMovementModal = useCreateStockMovement(selectedId, refetch);

  const handleProductChange = useCallback((id?: number) => {
    setProductId(id);
  }, []);

  const handleBranchChange = useCallback((id?: number) => {
    setBranchId(id);
  }, []);

  const handleDefaultChange = useCallback((id?: number) => {
    setIsDefault(id);
  }, []);

  const handlePriceEditableChange = useCallback((id?: number) => {
    setPriceEditable(id);
  }, []);

  const handleClearFilter = useCallback(() => {
    setProductId(null);
    setBranchId(null);
    setIsDefault(null);
    setStatus(null);
    setPriceEditable(null);
    setBasePriceGte(null);
    setBasePriceLte(null);
    setOnlinePriceGte(null);
    setOnlinePriceLte(null);
    setExpiryDateGte(null);
    setExpiryDateLte(null);
    setStockGte(null);
    setStockLte(null);
    setFilterKey((k) => k + 1);
  }, []);

  return {
    productInventories,
    products,
    branches,
    pagination,
    search,
    isLoading,
    isLoadingProduct,
    isLoadingBranch,
    selectedId,
    filterKey,
    handlePageChange,
    handleSearch,
    handleProductChange,
    handleBranchChange,
    handleDefaultChange,
    handleClearFilter,
    handlePriceEditableChange,
    setBasePriceGte,
    setBasePriceLte,
    setOnlinePriceGte,
    setOnlinePriceLte,
    setExpiryDateGte,
    setExpiryDateLte,
    setStatus,
    setStockGte,
    setStockLte,
    setSelectedId,

    //Modal
    editModal,
    createModal,
    deleteModal,
    createStockMovementModal,
  };
};

export default useProductInventories;
