import { IDeliveries } from "@/@types/deliveries";
import { IDetailParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetDeliveries = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["deliverie", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IDeliveries }>(
        `deliveries/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetDeliveries;
