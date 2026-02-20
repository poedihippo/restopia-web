import useGetProductUomsList from "@/hooks/product-uoms/useGetProductUomsList";
import useGetProductList from "@/hooks/product/useGetProductList";
import useGetUOMList from "@/hooks/uom/useGetUOMList";
import useDataTable from "@/hooks/useDataTable";
import { useCallback, useMemo, useState } from "react";
import { useCreateProductUomsModal } from "./Modal/useCreateProductUomsModal";
import { useDeleteProductUomsModal } from "./Modal/useDeleteProductUomsModal";
import { useEditProductUomsModal } from "./Modal/useEditProductUomsModal";

const useProductUoms = () => {
  const [productId, setProductId] = useState<number>();
  const [uomId, setUomId] = useState<number>();
  const [isDefault, setIsDefault] = useState<number>();
  const [priceGte, setPriceGte] = useState<number>();
  const [PriceLte, setPriceLte] = useState<number>();

  const extraParams = useMemo(
    () => ({
      include: "created_by,updated_by,product,uom",
      filter: {
        product_id: productId,
        uom_id: uomId,
        is_default: isDefault,
        price_qte: priceGte,
        price_lte: PriceLte,
      },
    }),
    [productId, uomId, isDefault, priceGte, PriceLte],
  );
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

  return {
    productUom,
    products,
    uoms,
    pagination,
    search,
    isLoading,
    isLoadingProduct,
    isLoadingUom,
    handlePageChange,
    handleSearch,
    handleProductChange,
    handleUomChange,
    handleDefaultChange,
    setPriceGte,
    setPriceLte,

    //Modal
    editModal,
    createModal,
    deleteModal,
  };
};

export default useProductUoms;
