import { ISuccessResponseMessage } from "@/@types/global";
import { IProductCategoriesDTO } from "@/@types/product-categories";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IProductCategoriesDTO;
}

const useProductCategoriesUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`product-categories/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductCategoriesUpdateMutation;
