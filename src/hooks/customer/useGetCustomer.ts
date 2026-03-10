import { ICustomer } from "@/@types/customer";
import { IDetailParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetCustomer = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["customer", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: ICustomer }>(
        `customers/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetCustomer;
