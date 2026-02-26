import { ISuccessResponseMessage } from "@/@types/global";
import { IRecipeDTO } from "@/@types/recipes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import api from "../useApi";

const useRecipeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IRecipeDTO) =>
      api.post("recipes", data),

    onSuccess: (res: AxiosResponse<ISuccessResponseMessage>) => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      return res;
    },

    onError: (err) => {
      return err;
    },
  });
};

export default useRecipeMutation;
