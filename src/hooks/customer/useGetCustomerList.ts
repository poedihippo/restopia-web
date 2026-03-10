import { ICustomerList } from "@/@types/customer";
import { IListParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetCustomerList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["customers", "list", params],
    queryFn: async () => {
      const response = await api.get<ICustomerList>(
        "customers",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetCustomerList;
