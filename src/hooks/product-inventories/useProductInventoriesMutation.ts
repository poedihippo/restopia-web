import { ISuccessResponseMessage } from "@/@types/global";
import { IProductInventoriesDTO } from "@/@types/product-inventories";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useProductInventoriesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IProductInventoriesDTO) =>
      api.post("product-inventories", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-inventories"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductInventoriesMutation;
