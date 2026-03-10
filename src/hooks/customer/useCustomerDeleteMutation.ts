import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../useApi";
import { AxiosResponse } from "axios";
import { ISuccessResponseMessage } from "@/@types/global";

const useCustomerDeleteMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => api.delete(`customers/${id}`),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useCustomerDeleteMutation;
