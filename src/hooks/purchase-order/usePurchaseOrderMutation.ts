import { ISuccessResponseMessage } from "@/@types/global";
import { IPurchaseOrderDTO } from "@/@types/purchase-orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const usePurchaseOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IPurchaseOrderDTO) =>
      api.post("purchase-orders", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default usePurchaseOrderMutation;
