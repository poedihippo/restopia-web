import { IDeliveriesDTO } from "@/@types/deliveries";
import { ISuccessResponseMessage } from "@/@types/global";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useDeliveriesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IDeliveriesDTO) =>
      api.post("deliveries", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useDeliveriesMutation;
