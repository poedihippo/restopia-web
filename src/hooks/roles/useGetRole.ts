import { IDetailParams } from "@/@types/global";
import { IRole } from "@/@types/role";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetRole = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["roles", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IRole }>(`roles/${id}`, {
        params,
      });
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetRole;
