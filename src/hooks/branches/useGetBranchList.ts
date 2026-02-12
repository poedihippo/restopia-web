import { IBranchList } from "@/@types/branch";
import { IListParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetBranchList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["branches", "list", params],
    queryFn: async () => {
      const response = await api.get<IBranchList>("branches", { params });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetBranchList;
