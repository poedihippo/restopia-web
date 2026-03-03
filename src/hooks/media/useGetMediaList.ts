import { IListParams } from "@/@types/global";
import { IMediaList } from "@/@types/media";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";

const useGetMediaList = (
  params?: IListParams,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["medias", "list", params],
    queryFn: async () => {
      const response = await api.get<IMediaList>(
        "media",
        { params },
      );
      return response.data;
    },
    enabled: options?.enabled,
  });
};

export default useGetMediaList;
