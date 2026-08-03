import useGetMediaList from '@/hooks/media/useGetMediaList';
import useDataTable from '@/hooks/useDataTable';
import { useMemo } from 'react';
import { useCreateMediaModal } from './Modal/useCreateMediaModal';
import { useDeleteMediaModal } from './Modal/useDeleteMediaModal';

interface Props {
    media_type?: string;
    media_id?: string | number
}

const useMedia = ({ media_id, media_type }: Props) => {

    const extraParams = useMemo(
        () => ({
            include: 'created_by,updated_by'
        }),
        [],
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
