import { IListParams } from "@/@types/global";
import { IProductList } from "@/@types/product";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";
import { useActiveBranchProductTypes } from "../useProductTypes";

const useGetProductList = (
  params?: IListParams & {
    "filter[product_types]"?: string;
  },
  options?: { enabled?: boolean },
) => {
  const activeProductTypes = useActiveBranchProductTypes();
  const mergedParams = {
    ...(activeProductTypes
      ? {
          "filter[product_types]": activeProductTypes,
        }
      : {}),
    ...params,
  };

  return useQuery({
    queryKey: ["products", "list", mergedParams],
    queryFn: async () => {
      const response = await api.get<IProductList>(
        "products",
        { params: mergedParams },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductList;
