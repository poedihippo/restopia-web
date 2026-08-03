import useGetProductCategoriesList from "@/hooks/product-categories/useGetProductCategoriesList";
import useDataTable from "@/hooks/useDataTable";
import { useMemo } from "react";
import { useCreateProductCategoriesModal } from "./Modal/useCreateProductCategoriesModal";
import { useDeleteProductCategoriesModal } from "./Modal/useDeleteProductCategoriesModal";
import { useEditProductCategoriesModal } from "./Modal/useEditProductCategoriesModal";

const useProductCategories = () => {
  const {
    queryParams,
    search,
    buildPagination,
    handlePageChange,
    handleSearch,
  } = useDataTable({ defaultSort: "-id" });

  const { data, isLoading, refetch } = useGetProductCategoriesList(queryParams);
  const productCategories = useMemo(() => data?.data ?? [], [data?.data]);

  const pagination = useMemo(
    () => buildPagination(data?.meta),
    [buildPagination, data?.meta],
  );

  const editModal = useEditProductCategoriesModal(refetch);
  const createModal = useCreateProductCategoriesModal(refetch);
  const deleteModal = useDeleteProductCategoriesModal(refetch);

  return {
    productCategories,
    pagination,
    isLoading,
    search,
    handlePageChange,
    handleSearch,

    //Modal
    editModal,
    createModal,
    deleteModal,
  };
};

export default useProductCategories;
