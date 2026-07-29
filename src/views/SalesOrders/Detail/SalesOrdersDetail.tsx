import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import useSalesOrdersDetail from './useSalesOrdersDetail'
import { formatterIDR } from '@/helper/convertCurrency'
import { formatCurrency } from '@/utils/price';


interface Props {
    id: number
    payments?: any[]
    totalPaid?: number
    lineItemsSlot?: ReactNode
}

const sectionCardStyle: CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: 24,
    marginTop: 16,
}

const SalesOrdersDetail = ({
    id,
    payments = [],
    totalPaid = 0,
    lineItemsSlot,
}: Props) => {
    const router = useRouter()
    const { data, isLoading } = useSalesOrdersDetail({ id })

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
                            <p className='text-md font-medium'>Customer Name:</p>
                            <p className='text-sm text-gray-500'>{data?.customer_name ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Customer Phone:</p>
                            <p className='text-sm text-gray-500'>{data?.customer_phone ?? '-'}</p>
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
                            <p className='text-md font-medium'>Total Price:</p>
                            <p className='text-sm text-gray-500'>{formatterIDR(data?.total_price as number) ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Subtotal Price:</p>
                            <p className='text-sm text-gray-500'>{formatterIDR(data?.subtotal_price as number) ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Discount Price:</p>
                            <p className='text-sm text-gray-500'>{formatterIDR(data?.discount_price as number) ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Date:</p>
                            <p className='text-sm text-gray-500'>{data?.date ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Fulfillment Date:</p>
                            <p className='text-sm text-gray-500'>{data?.fulfillment_date ? format(new Date(data?.fulfillment_date), "dd/MM/yyyy") : '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Created At:</p>
                            <p className='text-sm text-gray-500'>{data?.created_at ?? '-'}</p>
                        </div>
                        <div className='flex flex-col gap-0'>
                            <p className='text-md font-medium'>Updated At:</p>
                            <p className='text-sm text-gray-500'>{data?.updated_at ?? '-'}</p>
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

            {!isLoading && lineItemsSlot}

            {!isLoading && data && (
                <div style={sectionCardStyle}>
                    <h2
                        style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: 16,
                            fontWeight: 700,
                            marginBottom: 20,
                            color: 'var(--foreground)',
                        }}
                    >
                        Payments
                    </h2>

                    {payments.length === 0 ? (
                        <p style={{ fontSize: 14, color: 'var(--foreground-muted)' }}>
                            No payments recorded.
                        </p>
                    ) : (
                        <>
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    marginBottom: 16,
                                }}
                            >
                                <thead>
                                    <tr>
                                        {['Method', 'Amount', 'Description', 'Date'].map((h) => (
                                            <th
                                                key={h}
                                                style={{
                                                    padding: '8px 12px',
                                                    textAlign: 'left',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: 'var(--foreground-muted)',
                                                    borderBottom: '1px solid var(--border)',
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p: any) => (
                                        <tr key={p.id}>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    borderBottom: '1px solid var(--border)',
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {p.payment_method?.name ?? '—'}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    borderBottom: '1px solid var(--border)',
                                                    color: 'var(--success)',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {formatCurrency(Number(p.amount))}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    borderBottom: '1px solid var(--border)',
                                                    color: 'var(--foreground-muted)',
                                                }}
                                            >
                                                {p.description ?? '—'}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '10px 12px',
                                                    fontSize: 14,
                                                    borderBottom: '1px solid var(--border)',
                                                    color: 'var(--foreground-muted)',
                                                }}
                                            >
                                                {p.created_at ? p.created_at : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ width: 280 }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 8,
                                            fontSize: 14,
                                        }}
                                    >
                                        <span style={{ color: 'var(--foreground-muted)' }}>
                                            Order Total
                                        </span>
                                        <span>
                                            Rp{' '}
                                            {formatCurrency(Number(data.total_price ?? 0), '')}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: 8,
                                            fontSize: 14,
                                        }}
                                    >
                                        <span style={{ color: 'var(--foreground-muted)' }}>
                                            Total Paid
                                        </span>
                                        <span
                                            style={{ color: 'var(--success)', fontWeight: 600 }}
                                        >
                                            {formatCurrency(totalPaid)}
                                        </span>
                                    </div>
                                    {totalPaid < Number(data.total_price ?? 0) && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: 14,
                                                borderTop: '1px solid var(--border)',
                                                paddingTop: 8,
                                            }}
                                        >
                                            <span
                                                style={{ color: 'var(--destructive)', fontWeight: 600 }}
                                            >
                                                Remaining
                                            </span>
                                            <span
                                                style={{ color: 'var(--destructive)', fontWeight: 700 }}
                                            >
                                                Rp{' '}
                                                {formatCurrency(
                                                    Number(data.total_price ?? 0) - totalPaid, '')}
                                            </span>
                                        </div>
                                    )}
                                    {totalPaid >= Number(data.total_price ?? 0) && (
                                        <div
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                fontSize: 14,
                                                borderTop: '1px solid var(--border)',
                                                paddingTop: 8,
                                            }}
                                        >
                                            <span
                                                style={{ color: 'var(--success)', fontWeight: 600 }}
                                            >
                                                ✓ Fully Paid
                                            </span>
                                            {totalPaid > Number(data.total_price ?? 0) && (
                                                <span
                                                    style={{
                                                        color: 'var(--foreground-muted)',
                                                        fontSize: 13,
                                                    }}
                                                >
                                                    Change: Rp{' '}
                                                    {formatCurrency(
                                                        totalPaid - Number(data.total_price ?? 0), '')}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
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

export default SalesOrdersDetail
