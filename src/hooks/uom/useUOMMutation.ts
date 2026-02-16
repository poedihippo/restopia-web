import { ISuccessResponseMessage } from "@/@types/global";
import { IUOMDTO } from "@/@types/uom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useUOMMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IUOMDTO) =>
      api.post("uoms", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["uoms"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useUOMMutation;
