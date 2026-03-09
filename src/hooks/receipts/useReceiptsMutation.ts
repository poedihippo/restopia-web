import { ISuccessResponseMessage } from "@/@types/global";
import { IReceiptDTO } from "@/@types/receipts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useReceiptsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IReceiptDTO) =>
      api.post("receipts", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useReceiptsMutation;
