import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { getProductUomName } from '@/utils/productUomName'
import usePurchaseOrderDetail from './usePurchaseOrderDetail'

interface Props {
    id: number
}


const PurchaseOrderDetail = ({ id }: Props) => {
    const router = useRouter()
    const { data, isLoading } = usePurchaseOrderDetail({ id })

    return (
        <div>
            <div className="flex gap-4 mb-4">
                <button onClick={() => router.back()} className='cursor-pointer'>
                    <ArrowLeft />
                </button>
                <p className="font-semibold text-2xl">Back</p>
            </div>
            {isLoading ? (
                <div className='bg-gray-300 animate-pulse shadow-xl border p-4 rounded-xl grid grid-cols-2 lg:grid-cols-4 gap-2 h-36' />
            ) : (
                <div className='bg-white shadow-xl border p-4 rounded-xl gap-2'>
                    <div className='grid grid-cols-2 lg:grid-cols-4 gap-2'>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Code:</p>
                            <p className='text-sm text-gray-500'>{data?.code ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Branch Name:</p>
                            <p className='text-sm text-gray-500'>{data?.branch?.name ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Branch Code:</p>
                            <p className='text-sm text-gray-500'>{data?.branch?.code ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Status:</p>
                            <p className={cn("text-sm", data?.status === 'final' ? 'text-red-500' : data?.status === 'pending' ? 'text-yellow-500' : '')}>{data?.status === 'final' ? "Final" : data?.status === 'pending' ? "Pending" : "-"}</p>
                        </div>

                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Created At:</p>
                            <p className='text-sm text-gray-500'>{data?.created_at ? format(data?.created_at, "dd/MM/yyyy") : '-'}</p>
                        </div>

                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Updated At:</p>
                            <p className='text-sm text-gray-500'>{data?.updated_at ? format(data?.updated_at, "dd/MM/yyyy") : '-'}</p>
                        </div>

                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Created By:</p>
                            <p className='text-sm text-gray-500'>{data?.created_by?.name}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Updated By:</p>
                            <p className='text-sm text-gray-500'>{data?.updated_by?.name}</p>
                        </div>
                    </div>
                    <div className='flex flex-col gap-0 mt-2'>
                        <p className='text-md font-medium'>Description:</p>
                        <p className='text-sm text-gray-500'>{data?.description ?? '-'}</p>
                    </div>
                </div>

            )}

            {isLoading ? (
                <div className='bg-gray-300 animate-pulse shadow-xl border p-4 rounded-xl h-64 my-4' />
            ) : data?.purchase_order_details && data.purchase_order_details.length > 0 && (
                <div className='bg-white shadow-xl border p-4 rounded-xl my-4'>
                    <h1 className='text-xl font-semibold mb-4'>Purchase Order Details</h1>
                    <div className='space-y-4'>
                        {data.purchase_order_details.map((detail, index) => {
                            const productUom = detail.product_inventory?.product_uom
                            const product = productUom?.product
                            const uom = productUom?.uom
                            return (
                                <div key={detail.id ?? index} className='border rounded-xl overflow-hidden'>
                                    <div className='bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-b'>
                                        <div>
                                            <p className='text-xs text-gray-400'>Product</p>
                                            <p className='font-semibold text-sm'>{getProductUomName(productUom, product?.name) || '-'}</p>
                                        </div>
                                        <div>
                                            <p className='text-xs text-gray-400'>SKU</p>
                                            <p className='font-semibold text-sm'>{detail.product_inventory?.sku ?? '-'}</p>
                                        </div>
                                        <div>
                                            <p className='text-xs text-gray-400'>Qty</p>
                                            <p className='font-semibold text-sm'>
                                                {detail.qty ?? '-'} <span className='text-gray-400 font-normal'>{uom?.name ?? ''}</span>
                                            </p>
                                        </div>
                                        {detail.description && (
                                            <div>
                                                <p className='text-xs text-gray-400'>Note</p>
                                                <p className='text-sm text-gray-600'>{detail.description}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className='bg-gray-300 animate-pulse shadow-xl border p-4 rounded-xl grid grid-cols-2 lg:grid-cols-4 gap-2 h-64 my-4' />
            ) : data?.media && data.media.length > 0 &&
            <div className='bg-white shadow-xl border p-4 rounded-xl my-4'>
                <h1 className='text-xl my-2'>Images</h1>
                <div className='w-full grid grid-cols-3 lg:grid-cols-5 gap-4'>
                    {data?.media.map((item, index) => (
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
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            }

        </div>
    )
}

export default PurchaseOrderDetail
