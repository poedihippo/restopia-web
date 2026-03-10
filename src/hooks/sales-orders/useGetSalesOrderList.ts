import { IListParams } from "@/@types/global";
import { ISalesOrderList } from "@/@types/sales-orders";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetSalesOrderList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["sales-orders", "list", params],
    queryFn: async () => {
      const response = await api.get<ISalesOrderList>(
        "sales-orders",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetSalesOrderList;
