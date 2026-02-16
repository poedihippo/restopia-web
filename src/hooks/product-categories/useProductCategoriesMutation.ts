import { ISuccessResponseMessage } from "@/@types/global";
import { IProductCategoriesDTO } from "@/@types/product-categories";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useProductCategoriesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IProductCategoriesDTO) =>
      api.post("product-categories", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductCategoriesMutation;
