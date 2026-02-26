import { IListParams } from "@/@types/global";
import { IRecipesList } from "@/@types/recipes";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetRecipeList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["recipes", "list", params],
    queryFn: async () => {
      const response = await api.get<IRecipesList>(
        "recipes",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetRecipeList;
