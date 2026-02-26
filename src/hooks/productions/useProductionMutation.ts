import { ISuccessResponseMessage } from "@/@types/global";
import { IProductionDTO } from "@/@types/productions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useProductionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IProductionDTO) => api.post("productions", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["productions"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductionMutation;
