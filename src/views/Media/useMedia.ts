import useGetMediaList from '@/hooks/media/useGetMediaList';
import useDataTable from '@/hooks/useDataTable';
import { useMemo } from 'react';
import { useCreateMediaModal } from './Modal/useCreateMediaModal';
import { useDeleteMediaModal } from './Modal/useDeleteMediaModal';

interface Props {
    media_type?: string;
    media_id?: string | number
    /** Value for `filter[media_type]` on GET /v1/media ('' = all). */
    mediaTypeFilter?: string
}

const useMedia = ({ media_id, media_type, mediaTypeFilter }: Props) => {

    const extraParams = useMemo(
        () => ({
            include: 'created_by,updated_by',
            'filter[media_type]': mediaTypeFilter || undefined,
        }),
        [mediaTypeFilter],
    );

    const {
        queryParams,
        search,
        buildPagination,
        handlePageChange,
        handleSearch,
    } = useDataTable({ defaultSort: "-id", extraParams });

    const { data, isLoading, refetch } = useGetMediaList(queryParams);
    const medias = useMemo(() => data?.data ?? [], [data?.data]);
    const pagination = useMemo(
        () => buildPagination(data?.meta),
        [buildPagination, data?.meta],
    );

    const createModal = useCreateMediaModal(media_type, media_id, refetch);
    const deleteModal = useDeleteMediaModal(refetch);

    return {
        medias,
        pagination,
        isLoading,
        search,
        handlePageChange,
        handleSearch,

        //Modal,
        createModal,
        deleteModal,
    };
}

export default useMedia
