import { ISuccessResponseMessage } from "@/@types/global";
import { IVoucherDTO } from "@/@types/voucher";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";
import { ICustomerDTO } from "@/@types/customer";

interface UpdateUserParams {
  id: string | number;
  data: ICustomerDTO;
}

const useCustomerUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`customers/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useCustomerUpdateMutation;
