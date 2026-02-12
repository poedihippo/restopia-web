import { IDetailParams } from "@/@types/global";
import { IUser } from "@/@types/user";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetUser = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["users", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IUser }>(`users/${id}`, {
        params,
      });
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetUser;
