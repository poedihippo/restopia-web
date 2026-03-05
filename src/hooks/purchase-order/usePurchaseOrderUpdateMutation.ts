import { ISuccessResponseMessage } from "@/@types/global";
import { IPurchaseOrderDTO } from "@/@types/purchase-orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IPurchaseOrderDTO;
}

const usePurchaseOrderUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`purchase-orders/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default usePurchaseOrderUpdateMutation;
