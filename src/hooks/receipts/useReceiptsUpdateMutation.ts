import { ISuccessResponseMessage } from "@/@types/global";
import { IReceiptDTO } from "@/@types/receipts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IReceiptDTO;
}

const useReceiptsUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`receipts/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useReceiptsUpdateMutation;
