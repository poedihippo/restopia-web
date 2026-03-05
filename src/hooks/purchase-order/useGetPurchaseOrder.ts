import { IDetailParams } from "@/@types/global";
import { IPurchaseOrder } from "@/@types/purchase-orders";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetPurchaseOrder = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["purchase-order", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IPurchaseOrder }>(
        `purchase-orders/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetPurchaseOrder;
