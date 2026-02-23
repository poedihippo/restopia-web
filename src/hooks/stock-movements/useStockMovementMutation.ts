import { ISuccessResponseMessage } from "@/@types/global";
import { IStockMovementDTO } from "@/@types/stock-movements";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useStockMovementMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IStockMovementDTO) => api.post("stock-movements", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useStockMovementMutation;
