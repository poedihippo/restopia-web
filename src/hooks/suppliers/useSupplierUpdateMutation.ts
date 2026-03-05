import { ISuccessResponseMessage } from "@/@types/global";
import { ISupplierDTO } from "@/@types/supplier";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: ISupplierDTO;
}

const useSupplierUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`suppliers/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useSupplierUpdateMutation;
