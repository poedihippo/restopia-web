import { IListParams } from "@/@types/global";
import { IStockMovementsList } from "@/@types/stock-movements";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetStockMovementList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["stock-movements", "list", params],
    queryFn: async () => {
      const response = await api.get<IStockMovementsList>("stock-movements", {
        params,
      });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetStockMovementList;
