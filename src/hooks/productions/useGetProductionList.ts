import { IListParams } from "@/@types/global";
import { IProductionsList } from "@/@types/productions";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetProductionList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["productions", "list", params],
    queryFn: async () => {
      const response = await api.get<IProductionsList>("productions", { params });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetProductionList;
