import { ISuccessResponseMessage } from "@/@types/global";
import { IProductDTO } from "@/@types/product";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useProductMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IProductDTO) =>
      api.post("products", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductMutation;
