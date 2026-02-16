import { ISuccessResponseMessage } from "@/@types/global";
import { IProductDTO } from "@/@types/product";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IProductDTO;
}

const useProductUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`products/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductUpdateMutation;
