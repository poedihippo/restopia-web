import { IDetailParams } from "@/@types/global";
import { IReceipt } from "@/@types/receipts";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetReceipts = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["receipt", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IReceipt }>(
        `receipts/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetReceipts;
