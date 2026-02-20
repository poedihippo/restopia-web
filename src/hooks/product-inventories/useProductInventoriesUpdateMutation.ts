import { ISuccessResponseMessage } from "@/@types/global";
import { IProductInventoriesDTO } from "@/@types/product-inventories";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: IProductInventoriesDTO;
}

const useProductInventoriesUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`product-inventories/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-inventories"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductInventoriesUpdateMutation;
