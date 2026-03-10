import { IDetailParams } from "@/@types/global";
import { IVoucher } from "@/@types/voucher";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetVoucher = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["voucher", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IVoucher }>(
        `vouchers/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetVoucher;
