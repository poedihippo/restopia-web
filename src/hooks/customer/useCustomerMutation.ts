import { ICustomerDTO } from "@/@types/customer";
import { ISuccessResponseMessage } from "@/@types/global";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICustomerDTO) =>
      api.post("customers", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useCustomerMutation;
