import { IDetailParams } from "@/@types/global";
import { ISupplier } from "@/@types/supplier";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetSupplier = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["supplier", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: ISupplier }>(
        `suppliers/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetSupplier;
