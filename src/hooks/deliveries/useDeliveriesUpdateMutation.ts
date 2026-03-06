import { IDeliveriesDTO } from "@/@types/deliveries";
import { ISuccessResponseMessage } from "@/@types/global";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IDeliveriesDTO;
}

const useDeliveriesUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`deliveries/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useDeliveriesUpdateMutation;
