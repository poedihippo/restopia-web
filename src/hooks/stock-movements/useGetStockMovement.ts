import { IDetailParams } from "@/@types/global";
import { IStockMovement } from "@/@types/stock-movements";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetStockMovement = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["stock-movement", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IStockMovement }>(
        `stock-movements/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetStockMovement;
