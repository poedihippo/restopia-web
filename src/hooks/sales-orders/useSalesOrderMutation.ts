import { ISalesOrderDTO } from "@/@types/sales-orders";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useSalesOrderMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ISalesOrderDTO) =>
      api.post<{ data: { id: number } }>("sales-orders", data),

    onSuccess: (res: AxiosResponse<{ data: { id: number } }>) => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useSalesOrderMutation;
