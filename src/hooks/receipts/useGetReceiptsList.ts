import { IListParams } from "@/@types/global";
import { IReceiptsList } from "@/@types/receipts";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetReceiptsList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["receipts", "list", params],
    queryFn: async () => {
      const response = await api.get<IReceiptsList>(
        "receipts",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetReceiptsList;
