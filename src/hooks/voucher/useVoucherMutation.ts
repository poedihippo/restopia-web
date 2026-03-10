import { ISuccessResponseMessage } from "@/@types/global";
import { IVoucherDTO } from "@/@types/voucher";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useVoucherMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IVoucherDTO) =>
      api.post("vouchers", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useVoucherMutation;
