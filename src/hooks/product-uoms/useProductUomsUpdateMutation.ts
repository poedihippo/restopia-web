import { ISuccessResponseMessage } from "@/@types/global";
import { IProductUomDTO } from "@/@types/product-uoms";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IProductUomDTO;
}

const useProductUomsUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`product-uoms/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-uoms"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductUomsUpdateMutation;
