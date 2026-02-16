import { IListParams } from "@/@types/global";
import { IProductCategoriesList } from "@/@types/product-categories";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductCategoriesList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["product-categories", "list", params],
    queryFn: async () => {
      const response = await api.get<IProductCategoriesList>(
        "product-categories",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductCategoriesList;
