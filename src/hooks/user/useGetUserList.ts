import { IListParams } from "@/@types/global";
import { IUserList } from "@/@types/user";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetUserList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["users", "list", params],
    queryFn: async () => {
      const response = await api.get<IUserList>("users", { params });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetUserList;
