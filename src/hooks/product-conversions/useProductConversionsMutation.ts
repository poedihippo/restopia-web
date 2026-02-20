import { ISuccessResponseMessage } from "@/@types/global";
import { IProductConversionsDTO } from "@/@types/product-conversions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useProductConversionsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IProductConversionsDTO) =>
      api.post("product-conversions", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["product-conversions"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useProductConversionsMutation;
