import { IDetailParams } from "@/@types/global";
import { useQuery } from "@tanstack/react-query";
import api from "../useApi";
import { IMedia } from "@/@types/media";

const useGetMedia = (
  id: string | number,
  params?: IDetailParams,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["media", id, params],
    queryFn: async () => {
      const response = await api.get<{ data: IMedia }>(
        `media/${id}`,
        {
          params,
        },
      );
      return response.data.data;
    },
    enabled: enabled && !!id,
  });
};

export default useGetMedia;
