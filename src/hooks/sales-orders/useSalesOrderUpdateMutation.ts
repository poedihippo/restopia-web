import { ISuccessResponseMessage } from "@/@types/global";
import { ISalesOrderDTO } from "@/@types/sales-orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: ISalesOrderDTO;
}

const useSalesOrderUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`sales-orders/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useSalesOrderUpdateMutation;
