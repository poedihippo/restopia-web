import useGetProductList from "@/hooks/product/useGetProductList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useEditProductModal } from "./Modal/useEditProductModal";
import { useCreateProductModal } from "./Modal/useCreateProductModal";
import { useDeleteProductModal } from "./Modal/useDeleteProductModal";
import useGetProductCategoriesList from "@/hooks/product-categories/useGetProductCategoriesList";

const useProduct = () => {
  const [productCategoryId, setProductCategoryId] = useState<number>();
  const [type, setType] = useState<string>();

  const extraParams = useMemo(
    () => ({
      include: "product_category",
      filter: {
        product_category_id: productCategoryId,
        type: type,
      },
    }),
    [productCategoryId, type],
  );

  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } = useGetProductList(queryParams);
  const { data: pcData, isLoading: isLoadingPC } =
    useGetProductCategoriesList();
  const products = useMemo(() => data?.data ?? [], [data?.data]);
  const productCategory = useMemo(() => pcData?.data ?? [], [pcData?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const editModal = useEditProductModal(refetch);
  const createModal = useCreateProductModal(refetch);
  const deleteModal = useDeleteProductModal(refetch);

  const handleProductCategoryChange = useCallback((id?: number) => {
    setProductCategoryId(id);
  }, []);

  return {
    products,
    pagination,
    isLoading,
    search,
    productCategory,
    isLoadingPC,
    type,
    setType,
    handleProductCategoryChange,
    handlePageChange,
    handleSearch,
    editModal,
    createModal,
    deleteModal,
  };
};

export default useProduct;
