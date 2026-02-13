import { IListParams } from "@/@types/global";
import { IPermissionList } from "@/@types/permission";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetPermissionList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["permissions", "list", params],
    queryFn: async () => {
      const response = await api.get<IPermissionList>("permissions", {
        params,
      });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetPermissionList;
