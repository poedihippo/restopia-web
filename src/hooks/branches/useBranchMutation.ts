import { IBranchDTO } from "@/@types/branch";
import { ISuccessResponseMessage } from "@/@types/global";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useBranchMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IBranchDTO) => api.post("branches", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useBranchMutation;
