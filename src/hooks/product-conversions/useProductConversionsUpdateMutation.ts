import { ISuccessResponseMessage } from "@/@types/global";
import { IProductConversionsDTO } from "@/@types/product-conversions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IProductConversionsDTO;
}

const useProductConversionsUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`product-conversions/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-conversions"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductConversionsUpdateMutation;
