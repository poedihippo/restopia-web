import { ISuccessResponseMessage } from "@/@types/global";
import { IProductUomDTO } from "@/@types/product-uoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useProductUomsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IProductUomDTO) => api.post("product-uoms", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-uoms"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductUomsMutation;
