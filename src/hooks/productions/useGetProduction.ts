import { IDetailParams } from "@/@types/global";
import { IProduction } from "@/@types/productions";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProduction = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["production", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IProduction }>(
        `productions/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetProduction;
