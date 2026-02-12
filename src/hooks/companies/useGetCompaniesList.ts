import { ICompaniesList } from "@/@types/companies";
import { IListParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetCompaniesList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["companies", "list", params],
    queryFn: async () => {
      const response = await api.get<ICompaniesList>("companies", { params });
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetCompaniesList;
