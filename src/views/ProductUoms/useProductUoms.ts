import useGetProductUomsList from "@/hooks/product-uoms/useGetProductUomsList";
import useGetProductList from "@/hooks/product/useGetProductList";
import useGetUOMList from "@/hooks/uom/useGetUOMList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useCreateProductUomsModal } from "./Modal/useCreateProductUomsModal";
import { useDeleteProductUomsModal } from "./Modal/useDeleteProductUomsModal";
import { useEditProductUomsModal } from "./Modal/useEditProductUomsModal";

const useProductUoms = () => {
  const [productId, setProductId] = useState<number | null>();
  const [uomId, setUomId] = useState<number | null>();
  const [isDefault, setIsDefault] = useState<number | null>();
  const [priceEditable, setPriceEditable] = useState<number | null>();
  const [basePriceGte, setBasePriceGte] = useState<number | null>();
  const [basePriceLte, setBasePriceLte] = useState<number | null>();
  const [onlinePriceGte, setOnlinePriceGte] = useState<number | null>();
  const [onlinePriceLte, setOnlinePriceLte] = useState<number | null>();
  const [filterKey, setFilterKey] = useState(0);

  const extraParams = useMemo(() => {
    const filter: Record<string, unknown> = {
      product_id: productId,
      uom_id: uomId,
      is_default: isDefault,
      price_editable: priceEditable,
      base_price_qte: basePriceGte,
      base_price_lte: basePriceLte,
      online_price_qte: onlinePriceGte,
      online_price_lte: onlinePriceLte,
    }

    const activeFilter = Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v !== null)
    );

    return {
      include: "created_by,updated_by,product,uom",
      ...(Object.keys(activeFilter).length > 0 ? { filter: activeFilter } : {})
    }
  }, [
    productId,
    uomId,
    isDefault,
    basePriceGte,
    basePriceLte,
    priceEditable,
    onlinePriceGte,
    onlinePriceLte
  ]);
  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } = useGetProductUomsList(queryParams);
  const { data: productData, isLoading: isLoadingProduct } =
    useGetProductList();
  const { data: allUomData, isLoading: isLoadingUom } = useGetUOMList();

  const productUom = useMemo(() => data?.data ?? [], [data?.data]);
  const products = useMemo(() => productData?.data ?? [], [productData?.data]);
  const uoms = useMemo(() => allUomData?.data ?? [], [allUomData?.data]);
  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const editModal = useEditProductUomsModal(refetch);
  const createModal = useCreateProductUomsModal(refetch);
  const deleteModal = useDeleteProductUomsModal(refetch);

  const handleProductChange = useCallback((id?: number) => {
    setProductId(id);
  }, []);

  const handleUomChange = useCallback((id?: number) => {
    setUomId(id);
  }, []);

  const handleDefaultChange = useCallback((id?: number) => {
    setIsDefault(id);
  }, []);

  const handlePriceEditableChange = useCallback((id?: number) => {
    setPriceEditable(id);
  }, []);

  const handleClearFilter = useCallback(() => {
    setProductId(null);
    setUomId(null);
    setIsDefault(null);
    setPriceEditable(null);
    setBasePriceGte(null);
    setBasePriceLte(null);
    setOnlinePriceGte(null);
    setOnlinePriceLte(null);
    setFilterKey((k) => k + 1);
  }, []);

  return {
    productUom,
    products,
    uoms,
    pagination,
    search,
    isLoading,
    isLoadingProduct,
    isLoadingUom,
    filterKey,
    handlePageChange,
    handleSearch,
    handleProductChange,
    handleUomChange,
    handleDefaultChange,
    handlePriceEditableChange,
    handleClearFilter,
    setBasePriceGte,
    setBasePriceLte,
    setOnlinePriceGte,
    setOnlinePriceLte,


    //Modal
    editModal,
    createModal,
    deleteModal,
  };
};

export default useProductUoms;
