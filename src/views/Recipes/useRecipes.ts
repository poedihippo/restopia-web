import useGetProductList from "@/hooks/product/useGetProductList";
import useGetRecipeList from "@/hooks/recipes/useGetRecipeList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useEditRecipesModal } from "./Modal/useEditRecipesModal";
import { useCreateRecipesModal } from "./Modal/useCreateRecipesModal";
import { useDeleteRecipesModal } from "./Modal/useDeleteRecipesModal";

const useRecipes = () => {
  const [productId, setProductId] = useState<number>();

  const extraParams = useMemo(
    () => ({
      include: "created_by,updated_by,product",
      filter: {
        product_id: productId,
      },
    }),
    [productId],
  );

  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id", extraParams });

  const { data, isLoading, refetch } = useGetRecipeList(queryParams);
  const { data: productData, isLoading: isLoadingProduct } =
    useGetProductList();

  const recipes = useMemo(() => data?.data ?? [], [data?.data]);
  const products = useMemo(() => productData?.data ?? [], [productData?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const editModal = useEditRecipesModal(refetch);
  const createModal = useCreateRecipesModal(refetch);
  const deleteModal = useDeleteRecipesModal(refetch);

  const handleProductChange = useCallback((id?: number) => {
    setProductId(id);
  }, []);

  return {
    recipes,
    products,
    pagination,
    isLoading,
    search,
    isLoadingProduct,
    handleProductChange,
    handlePageChange,
    handleSearch,
    editModal,
    createModal,
    deleteModal,
  };
};

export default useRecipes;
