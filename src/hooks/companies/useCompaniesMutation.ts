import { ICompaniesDTO } from "@/@types/companies";
import { ISuccessResponseMessage } from "@/@types/global";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useCompaniesMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ICompaniesDTO) => api.post("companies", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useCompaniesMutation;
