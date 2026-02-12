import { IListParams } from "@/@types/global";
import { IRoleList } from "@/@types/role";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetRoleList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["roles", "list", params],
    queryFn: async () => {
      const response = await api.get<IRoleList>("roles", { params });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetRoleList;
