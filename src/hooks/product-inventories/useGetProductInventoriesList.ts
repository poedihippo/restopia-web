import { IListParams } from "@/@types/global";
import { IProductInventoriesList } from "@/@types/product-inventories";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";
import { useActiveBranchProductTypes } from "../useProductTypes";

const useGetProductInventoriesList = (
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
    queryKey: ["product-inventories", "list", mergedParams],
    queryFn: async () => {
      const response = await api.get<IProductInventoriesList>(
        "product-inventories",
        { params: mergedParams },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductInventoriesList;
