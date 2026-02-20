import useGetProductConversionsList from "@/hooks/product-conversions/useGetProductConversionsList";
import useGetProductList from "@/hooks/product/useGetProductList";
import useGetUOMList from "@/hooks/uom/useGetUOMList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useCreateProductConversionsModal } from "./Modal/useCreateProductConversionsModal";
import { useDeleteProductConversionsModal } from "./Modal/useDeleteProductConversionsModal";
import { useEditProductConversionsModal } from "./Modal/useEditProductConversionsModal";

const useProductConversions = () => {
  const [productId, setProductId] = useState<number>();
  const [uomId, setUomId] = useState<number>();
  const [targetUomId, setTargetUomId] = useState<number>();

  const extraParams = useMemo(
    () => ({
      include: "created_by,updated_by,product,uom,target_uom",
      filter: {
        product_id: productId,
        uom_id: uomId,
        target_uom_id: targetUomId,
      },
    }),
    [productId, uomId, targetUomId],
  );
  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } =
    useGetProductConversionsList(queryParams);
  const { data: productData, isLoading: isLoadingProduct } =
    useGetProductList();
  const { data: allUomData, isLoading: isLoadingUom } = useGetUOMList();

  const productConversions = useMemo(() => data?.data ?? [], [data?.data]);
  const products = useMemo(() => productData?.data ?? [], [productData?.data]);
  const uoms = useMemo(() => allUomData?.data ?? [], [allUomData?.data]);

  const filterTargetData = uoms.filter((item) => item.id !== targetUomId);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const editModal = useEditProductConversionsModal(refetch);
  const createModal = useCreateProductConversionsModal(refetch);
  const deleteModal = useDeleteProductConversionsModal(refetch);

  const handleProductChange = useCallback((id?: number) => {
    setProductId(id);
  }, []);

  const handleUomChange = useCallback((id?: number) => {
    setUomId(id);
  }, []);

  const handleTargetUomChange = useCallback((id?: number) => {
    setTargetUomId(id);
  }, []);

  return {
    productConversions,
    products,
    uoms,
    filterTargetData,
    pagination,
    search,
    isLoading,
    isLoadingProduct,
    isLoadingUom,
    handlePageChange,
    handleSearch,
    handleProductChange,
    handleUomChange,
    handleTargetUomChange,

    //Modal
    editModal,
    createModal,
    deleteModal,
  };
};

export default useProductConversions;
