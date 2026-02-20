import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../useApi";
import { AxiosResponse } from "axios";
import { ISuccessResponseMessage } from "@/@types/global";

const useProductUomsDeleteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => api.delete(`product-uoms/${id}`),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-uoms"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductUomsDeleteMutation;
