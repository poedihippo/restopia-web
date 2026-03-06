import { IDeliveriesList } from "@/@types/deliveries";
import { IListParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetDeliveriesList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["deliveries", "list", params],
    queryFn: async () => {
      const response = await api.get<IDeliveriesList>(
        "deliveries",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetDeliveriesList;
