import { ICompaniesDTO } from "@/@types/companies";
import { ISuccessResponseMessage } from "@/@types/global";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

interface UpdateUserParams {
  id: string | number;
  data: ICompaniesDTO;
}

const useCompaniesUpdateMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: UpdateUserParams) =>
      api.patch(`companies/${id}`, data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useCompaniesUpdateMutation;
