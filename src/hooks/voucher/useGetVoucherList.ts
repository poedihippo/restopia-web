import { IListParams } from "@/@types/global";
import { IVoucherList } from "@/@types/voucher";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetVoucherList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["vouchers", "list", params],
    queryFn: async () => {
      const response = await api.get<IVoucherList>(
        "vouchers",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetVoucherList;
