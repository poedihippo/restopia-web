import { DeleteConfirmModal } from '@/components/ui/delete-confirm-modal'
import { Input } from '@/components/ui/input'
import { Trash } from 'lucide-react'
import Image from 'next/image'
import { MediaModal } from './Modal/MediaModal'
import useMedia from './useMedia'
import { Button } from '@/components/ui/button'
import usePermission from '@/hooks/usePermission'

interface Props {
    media_type?: string;
    media_id?: string | number
}

const Media = ({ media_id, media_type }: Props) => {
    const {
        medias,
        pagination,
        isLoading,
        search,
        handlePageChange,
        handleSearch,
        createModal,
        deleteModal
    } = useMedia({ media_type, media_id })
    const {
        canDelete,
        canRead
    } = usePermission();

    const totalPages = Math.ceil(pagination.total / pagination.pageSize) || 1
    const canPrevious = pagination.current > 1
    const canNext = pagination.current < totalPages

    return (
        <div className="p-4 sm:p-6">
            <div className="mb-4 sm:mb-6">
                <h1 className="text-xl sm:text-2xl font-bold">Medias</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Manage your medias here
                </p>
            </div>
            <div className="mb-4 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 flex flex-col sm:flex-row gap-4">
                        <Input
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full sm:max-w-sm"
                        />
                    </div>
                    {/* <Button
                        onClick={() => createModal.openModal()}
                        className="w-full sm:w-auto"
                    >
                        Create Media
                    </Button> */}
                </div>
            </div>
            <div className='w-full grid grid-cols-2 lg:grid-cols-4 gap-4'>
                {medias.map((item, index) => (
                    <div key={index} className='bg-white shadow-xl rounded-2xl overflow-hidden'>
                        <div className="relative w-full aspect-square">
                            <button type='button' onClick={() => window.open(item.url)} className='cursor-pointer'>
                                <Image
                                    fill
                                    className="object-cover"
                                    src={item.url ?? ''}
                                    alt={item.file_name ?? ''}
                                />
                            </button>
                            {(<button
                                onClick={() => deleteModal.openModal(medias[index])}
                                className="absolute top-3 right-3 bg-white p-2 rounded-full shadow-lg hover:bg-gray-100 transition"
                                disabled={!canDelete('media')}>
                                <Trash className='text-red-500' size={18} />
                            </button>)}
                        </div>
                        <div className='p-3 space-y-1'>
                            <p className="text-sm font-medium truncate">{item.collection_name}</p>
                            <p className="text-sm text-muted-foreground truncate">{item.file_name}</p>
                            <p className="text-xs text-muted-foreground">{item.created_by?.name}</p>
                        </div>
                    </div>
                ))}
            </div>
            {!isLoading && medias.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8">
                    <div className="text-sm text-muted-foreground text-center sm:text-left">
                        Showing {((pagination.current - 1) * pagination.pageSize) + 1} to{' '}
                        {Math.min(pagination.current * pagination.pageSize, pagination.total)} of{' '}
                        {pagination.total} entries
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.current - 1)}
                            disabled={!canPrevious}
                        >
                            Previous
                        </Button>
                        <div className="hidden sm:flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={page === pagination.current ? 'default' : 'outline'}
                                    size="icon-sm"
                                    onClick={() => handlePageChange(page)}
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                        <span className="sm:hidden text-sm text-muted-foreground">
                            {pagination.current} / {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.current + 1)}
                            disabled={!canNext}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
            {/* Modals */}
            <DeleteConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={deleteModal.closeModal}
                onConfirm={deleteModal.handleConfirmDelete}
                label={deleteModal.selectedUser?.file_name}
                isDeleting={deleteModal.isDeleting}
            />
            {createModal.isOpen && (
                <MediaModal
                    mode="create"
                    isOpen={createModal.isOpen}
                    onClose={createModal.closeModal}
                    onSubmit={createModal.handleSubmit}
                    form={createModal.form}
                    isSubmitting={createModal.isSubmitting}
                />
            )}
        </div>
    );
}

export default Media
