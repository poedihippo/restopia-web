import useGetCustomerList from '@/hooks/customer/useGetCustomerList';
import useDataTable from '@/hooks/useDataTable';
import { useMemo } from 'react';
import { useEditCustomerModal } from './Modal/useEditCustomerModal';
import { useCreateCustomerModal } from './Modal/useCreateCustomerModal';
import { useDeleteCustomerModal } from './Modal/useDeleteCustomerModal';

const useCustomer = () => {
    const {
        queryParams,
        search,
        buildPagination,
        handlePageChange,
        handleSearch,
    } = useDataTable({ defaultSort: "-id" });

    const { data, isLoading, refetch } = useGetCustomerList(queryParams);
    const customers = useMemo(() => data?.data ?? [], [data?.data]);

    const pagination = useMemo(
        () => buildPagination(data?.meta),
        [buildPagination, data?.meta],
    );

    const editModal = useEditCustomerModal(refetch);
    const createModal = useCreateCustomerModal(refetch);
    const deleteModal = useDeleteCustomerModal(refetch);

    return {
        customers,
        pagination,
        isLoading,
        search,
        handlePageChange,
        handleSearch,

        //Modal
        editModal,
        createModal,
        deleteModal,
    }
}

export default useCustomer
