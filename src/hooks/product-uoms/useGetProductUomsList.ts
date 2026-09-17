import { IListParams } from "@/@types/global";
import { IProductUomsList } from "@/@types/product-uoms";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";
import { useActiveBranchProductTypes } from "../useProductTypes";

const useGetProductUomsList = (
  params?: IListParams & {
    "filter[product_types]"?: string;
  },
  options?: { enabled?: boolean },
) => {
  const activeProductTypes = useActiveBranchProductTypes();
  const mergedParams = {
    "filter[is_active]": true,
    ...(activeProductTypes
      ? {
          "filter[product_types]": activeProductTypes,
        }
      : {}),
    ...params,
  };

  return useQuery({
    queryKey: ["product-uoms", "list", mergedParams],
    queryFn: async () => {
      const response = await api.get<IProductUomsList>("product-uoms", {
        params: mergedParams,
      });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductUomsList;
