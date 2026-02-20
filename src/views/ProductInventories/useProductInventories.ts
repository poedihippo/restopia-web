import useGetBranchList from "@/hooks/branches/useGetBranchList";
import useGetProductInventoriesList from "@/hooks/product-inventories/useGetProductInventoriesList";
import useGetProductUomsList from "@/hooks/product-uoms/useGetProductUomsList";
import useDataTable from "@/hooks/useDataTable";
import React, { useCallback, useMemo, useState } from "react";
import { useEditProductInventoriesModal } from "./Modal/useEditProductInventoriesModal";
import { useCreateProductInventoriesModal } from "./Modal/useCreateProductInventoriesModal";
import { useDeleteProductInventoriesModal } from "./Modal/useDeleteProductInventoriesModal";

const useProductInventories = () => {
  const [productId, setProductId] = useState<number>();
  const [uomId, setUomId] = useState<number>();
  const [isDefault, setIsDefault] = useState<number>();
  const [status, setStatus] = useState<string>();
  const [priceGte, setPriceGte] = useState<number>();
  const [PriceLte, setPriceLte] = useState<number>();
  const [expiryDateGte, setExpiryDateGte] = useState<number>();
  const [expiryDateLte, setExpiryDateLte] = useState<number>();
  const [stockGte, setStockGte] = useState<number>();
  const [stockLte, setStockLte] = useState<number>();

  const extraParams = useMemo(
    () => ({
      include: "created_by,updated_by,branch,product_uom",
      filter: {
        product_id: productId,
        uom_id: uomId,
        is_default: isDefault,
        price_qte: priceGte,
        price_lte: PriceLte,
        status: status,
        expiry_date_gte: expiryDateGte,
        expiry_date_lte: expiryDateLte,
        stock_gte: stockGte,
        stock_lte: stockLte,
      },
    }),
    [
      productId,
      uomId,
      isDefault,
      priceGte,
      PriceLte,
      status,
      expiryDateGte,
      expiryDateLte,
      stockGte,
      stockLte,
    ],
  );
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

  const handleProductChange = useCallback((id?: number) => {
    setProductId(id);
  }, []);

  const handleUomChange = useCallback((id?: number) => {
    setUomId(id);
  }, []);

  const handleDefaultChange = useCallback((id?: number) => {
    setIsDefault(id);
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
    handlePageChange,
    handleSearch,
    handleProductChange,
    handleUomChange,
    handleDefaultChange,
    setPriceGte,
    setPriceLte,
    setExpiryDateGte,
    setExpiryDateLte,
    setStatus,
    setStockGte,
    setStockLte,

    //Modal
    editModal,
    createModal,
    deleteModal,
  };
};

export default useProductInventories;
