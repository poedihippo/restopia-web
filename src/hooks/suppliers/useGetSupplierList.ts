import { IListParams } from "@/@types/global";
import { ISupplierList } from "@/@types/supplier";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetSupplierList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["products", "list", params],
    queryFn: async () => {
      const response = await api.get<ISupplierList>(
        "suppliers",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetSupplierList;
