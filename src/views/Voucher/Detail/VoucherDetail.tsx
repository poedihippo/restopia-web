import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import useVoucherDetail from './useVoucherDetail'
import { formatterIDR } from '@/helper/convertCurrency'

interface Props {
    id: number
}


const VoucherDetail = ({ id }: Props) => {
    const router = useRouter()
    const { data, isLoading } = useVoucherDetail({ id })

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
                            <p className='text-md font-medium'>Name:</p>
                            <p className='text-sm text-gray-500'>{data?.name ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Discount Type:</p>
                            <p className='text-sm text-gray-500'>{data?.discount_type ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Discount Value:</p>
                            <p className='text-sm text-gray-500'>{data?.discount_type === 'percent' ? `${data.discount_value}%` : formatterIDR(data?.discount_value as number)}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Min Subtotal Price:</p>
                            <p className='text-sm text-gray-500'>{formatterIDR(data?.min_subtotal_price as number) ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Max Discount Price:</p>
                            <p className='text-sm text-gray-500'>{formatterIDR(data?.max_discount_price as number) ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Quota:</p>
                            <p className='text-sm text-gray-500'>{data?.quota ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Used Quota:</p>
                            <p className='text-sm text-gray-500'>{data?.used_quota ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Scope:</p>
                            <p className='text-sm text-gray-500'>{data?.scope ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Status:</p>
                            <p className={cn("text-sm", data?.status === 'active' ? 'text-green-500' : data?.status === 'inactive' ? 'text-gray-500' : '')}>{data?.status === 'active' ? "Active" : data?.status === 'inactive' ? "Inactive" : "-"}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Valid From:</p>
                            <p className='text-sm text-gray-500'>{data?.valid_from ? format(data?.valid_from, "dd/MM/yyyy") : '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Valid Until:</p>
                            <p className='text-sm text-gray-500'>{data?.valid_until ? format(data?.valid_until, "dd/MM/yyyy") : '-'}</p>
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
            ) : data?.voucher_branches && data.voucher_branches.length > 0 && (
                <div className='bg-white shadow-xl border p-4 rounded-xl my-4'>
                    <h1 className='text-xl font-semibold mb-4'>Voucher Branches Detail</h1>
                    <div className='space-y-4'>
                        {data.voucher_branches.map((detail, index) => {
                            return (
                                <div key={detail.id ?? index} className='border rounded-xl overflow-hidden'>
                                    <div className='bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-b'>
                                        <div>
                                            <p className='text-xs text-gray-400'>Quota</p>
                                            <p className='font-semibold text-sm'>{detail.quota ?? '-'}</p>
                                        </div>
                                        <div>
                                            <p className='text-xs text-gray-400'>Used Quota</p>
                                            <p className='font-semibold text-sm'>{detail.used_quota ?? '-'}</p>
                                        </div>
                                        <div>
                                            <p className='text-xs text-gray-400'>Branch:</p>
                                            <p className='font-semibold text-sm'>{detail.branch?.name ?? '-'} - {detail.branch?.code}</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {isLoading ? (
                <div className='bg-gray-300 animate-pulse shadow-xl border p-4 rounded-xl h-64 my-4' />
            ) : data?.voucher_product_uoms && data.voucher_product_uoms.length > 0 && (
                <div className='bg-white shadow-xl border p-4 rounded-xl my-4'>
                    <h1 className='text-xl font-semibold mb-4'>Voucher Products Uoms Detail</h1>
                    <div className='space-y-4'>
                        {data.voucher_product_uoms.map((detail, index) => {
                            return (
                                <div key={detail.id ?? index} className='border rounded-xl overflow-hidden'>
                                    <div className='bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-b'>
                                        <div>
                                            <p className='text-xs text-gray-400'>Quota</p>
                                            <p className='font-semibold text-sm'>{detail.quota ?? '-'}</p>
                                        </div>
                                        <div>
                                            <p className='text-xs text-gray-400'>Used Quota</p>
                                            <p className='font-semibold text-sm'>{detail.used_quota ?? '-'}</p>
                                        </div>
                                        <div>
                                            <p className='text-xs text-gray-400'>Product Uom:</p>
                                            <p className='font-semibold text-sm'>{detail.product_uom?.product?.name ?? '-'} - {detail.product_uom?.product?.code} - {formatterIDR(detail.product_uom?.price as number)}</p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

export default VoucherDetail
