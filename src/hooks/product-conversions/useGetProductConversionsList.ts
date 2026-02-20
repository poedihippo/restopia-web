import { IListParams } from "@/@types/global";
import { IProductConversionsList } from "@/@types/product-conversions";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductConversionsList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["product-conversions", "list", params],
    queryFn: async () => {
      const response = await api.get<IProductConversionsList>(
        "product-conversions",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductConversionsList;
