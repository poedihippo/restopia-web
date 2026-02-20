import { IListParams } from "@/@types/global";
import { IProductInventoriesList } from "@/@types/product-inventories";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductInventoriesList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["product-inventories", "list", params],
    queryFn: async () => {
      const response = await api.get<IProductInventoriesList>(
        "product-inventories",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductInventoriesList;
