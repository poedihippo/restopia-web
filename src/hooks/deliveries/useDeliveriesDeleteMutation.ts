import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../useApi";
import { AxiosResponse } from "axios";
import { ISuccessResponseMessage } from "@/@types/global";

const useDeliveriesDeleteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => api.delete(`deliveries/${id}`),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useDeliveriesDeleteMutation;
