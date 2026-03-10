import { IDetailParams } from "@/@types/global";
import { ISalesOrder } from "@/@types/sales-orders";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetSalesOrder = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["sales-order", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: ISalesOrder }>(
        `sales-orders/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetSalesOrder;
