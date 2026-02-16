import { IListParams } from "@/@types/global";
import { IProductList } from "@/@types/product";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["products", "list", params],
    queryFn: async () => {
      const response = await api.get<IProductList>(
        "products",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductList;
