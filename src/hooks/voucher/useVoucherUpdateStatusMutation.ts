import { ISuccessResponseMessage } from "@/@types/global";
import { IVoucherStatusDTO } from "@/@types/voucher";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IVoucherStatusDTO;
}

const useVoucherUpdateStatusMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`vouchers/${id}/status`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useVoucherUpdateStatusMutation;
