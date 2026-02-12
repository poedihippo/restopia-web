import { ICompanies } from "@/@types/companies";
import { IDetailParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetCompanies = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["companies", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: ICompanies }>(`companies/${id}`, {
        params,
      });
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetCompanies;
