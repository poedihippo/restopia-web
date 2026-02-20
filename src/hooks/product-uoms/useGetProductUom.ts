import { IDetailParams } from "@/@types/global";
import { IProduct } from "@/@types/product";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductUom = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["product-uom", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IProduct }>(
        `product-uoms/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetProductUom;
