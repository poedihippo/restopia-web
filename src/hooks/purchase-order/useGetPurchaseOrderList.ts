import { IListParams } from "@/@types/global";
import { IPurchaseOrderList } from "@/@types/purchase-orders";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetPurchaseOrderList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["purchase-orders", "list", params],
    queryFn: async () => {
      const response = await api.get<IPurchaseOrderList>(
        "purchase-orders",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetPurchaseOrderList;
