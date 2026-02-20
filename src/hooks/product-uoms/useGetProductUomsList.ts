import { IListParams } from "@/@types/global";
import { IProductUomsList } from "@/@types/product-uoms";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductUomsList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["product-uoms", "list", params],
    queryFn: async () => {
      const response = await api.get<IProductUomsList>("product-uoms", {
        params,
      });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductUomsList;
