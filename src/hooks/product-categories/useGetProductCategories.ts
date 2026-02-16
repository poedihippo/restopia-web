import { IDetailParams } from "@/@types/global";
import { IProductCategories } from "@/@types/product-categories";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductCategories = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["product-category", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IProductCategories }>(
        `product-categories/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetProductCategories;
