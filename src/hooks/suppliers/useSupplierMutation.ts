import { ISuccessResponseMessage } from "@/@types/global";
import { ISupplierDTO } from "@/@types/supplier";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useSupplierMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ISupplierDTO) =>
      api.post("suppliers", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useSupplierMutation;
