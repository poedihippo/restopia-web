import { IDetailParams } from "@/@types/global";
import { IProductConversions } from "@/@types/product-conversions";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductConversions = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["product-conversion", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IProductConversions }>(
        `product-conversions/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetProductConversions;
