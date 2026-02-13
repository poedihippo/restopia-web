import { IBranchList } from "@/@types/branch";
import { IListParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetPermissionList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["permissions", "list", params],
    queryFn: async () => {
      const response = await api.get<IBranchList>("permissions", { params });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetPermissionList;
