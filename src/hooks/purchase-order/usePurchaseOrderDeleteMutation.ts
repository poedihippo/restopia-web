import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../useApi";
import { AxiosResponse } from "axios";
import { ISuccessResponseMessage } from "@/@types/global";

const usePurchaseOrderDeleteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => api.delete(`purchase-orders/${id}`),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default usePurchaseOrderDeleteMutation;
