import useGetSupplierList from '@/hooks/suppliers/useGetSupplierList';
import useDataTable from '@/hooks/useDataTable';
import { useMemo } from 'react';
import { useCreateSuppliersModal } from './Modal/useCreateSuppliersModal';
import { useDeleteSuppliersModal } from './Modal/useDeleteSuppliersModal';
import { useEditSuppliersModal } from './Modal/useEditSuppliersModal';

const useSuppliers = () => {
    const {
        queryParams,
        search,
        buildPagination,
        handlePageChange,
        handleSearch,
    } = useDataTable({ defaultSort: "-id" });

    const { data, isLoading, refetch } = useGetSupplierList(queryParams);
    const suppliers = useMemo(() => data?.data ?? [], [data?.data]);

    const pagination = useMemo(
        () => buildPagination(data?.meta),
        [buildPagination, data?.meta],
    );

    const editModal = useEditSuppliersModal(refetch);
    const createModal = useCreateSuppliersModal(refetch);
    const deleteModal = useDeleteSuppliersModal(refetch);

    return {
        suppliers,
        pagination,
        isLoading,
        search,
        handlePageChange,
        handleSearch,
        editModal,
        createModal,
        deleteModal,
    };
}

export default useSuppliers
