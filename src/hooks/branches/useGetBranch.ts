import { ICompanies } from "@/@types/companies";
import { IDetailParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";
import { IBranch } from "@/@types/branch";

const useGetBranch = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["branches", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IBranch }>(`branches/${id}`, {
        params,
      });
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetBranch;
