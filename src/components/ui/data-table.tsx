import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from './skeleton'
import { Button } from './button'
import { Card, CardContent } from './card'

export interface Column<T = object> {
  title: string
  key: keyof T | string
  render?: (value: unknown, record: T, index: number) => React.ReactNode
  hideOnMobile?: boolean
}

export interface DataTableProps<T = object> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  emptyText?: string
  pagination?: {
    current: number
    pageSize: number
    total: number
    onChange: (page: number) => void
  }
  actions?: (record: T, index: number) => React.ReactNode
  onRowClick?: (record: T, index: number) => void
  className?: string
  canRead?: boolean
}

function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  emptyText = 'No data available',
  pagination,
  actions,
  onRowClick,
  className,
  canRead = true,
}: DataTableProps<T>) {
  const getNestedValue = (obj: T, key: string): unknown => {
    return key.split('.').reduce<unknown>((o, k) => {
      if (o && typeof o === 'object') return (o as Record<string, unknown>)[k]
      return undefined
    }, obj)
  }

  // Calculate pagination
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1
  const canPrevious = pagination ? pagination.current > 1 : false
  const canNext = pagination ? pagination.current < totalPages : false

  // Filter columns for mobile view
  const mobileColumns = columns.filter(col => !col.hideOnMobile)


  return (
    <div className={cn('space-y-4', className)}>
      {/* Desktop Table View */}
      <div className="hidden md:block rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                {columns.map((column, index) => (
                  <th
                    key={`header-${index}`}
                    className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    {column.title}
                  </th>
                ))}
                {actions && (
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody >
              {loading ? (
                // Loading state
                Array.from({ length: pagination?.pageSize || 5 }).map((_, rowIndex) => (
                  <tr key={`loading-${rowIndex}`} className="border-b">
                    {columns.map((_, colIndex) => (
                      <td key={`loading-cell-${colIndex}`} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    ))}
                    {actions && (
                      <td className="p-4">
                        <Skeleton className="h-8 w-20" />
                      </td>
                    )}
                  </tr>
                ))
              ) : data.length === 0 ? (
                // Empty state
                <tr>
                  <td
                    colSpan={columns.length + (actions ? 1 : 0)}
                    className="h-32 text-center text-muted-foreground"
                  >
                    {emptyText}
                  </td>
                </tr>
              ) : (
                // Data rows
                data.map((record, rowIndex) => (
                  <tr
                    key={`row-${rowIndex}`}
                    onClick={() => onRowClick?.(record, rowIndex)}
                    className={cn(
                      "border-b transition-colors",
                      rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-200',
                      onRowClick && "cursor-pointer"
                    )}
                  >
                    {columns.map((column, colIndex) => {
                      const value = getNestedValue(record, column.key as string)
                      const cellContent = column.render ? column.render(value, record, rowIndex) : String(value ?? '')
                      return (
                        <td key={`cell-${rowIndex}-${colIndex}`} className="p-4 align-middle">
                          {canRead ? cellContent : '***'}
                        </td>
                      )
                    })}
                    {actions && (
                      <td className="p-4 align-middle">
                        {actions(record, rowIndex)}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loading ? (
          // Loading state for mobile
          Array.from({ length: pagination?.pageSize || 5 }).map((_, index) => (
            <Card key={`mobile-loading-${index}`}>
              <CardContent className="p-4 space-y-3">
                {mobileColumns.map((_, colIndex) => (
                  <div key={`mobile-loading-cell-${colIndex}`} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
                {actions && (
                  <div className="pt-2 border-t">
                    <Skeleton className="h-8 w-full" />
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : data.length === 0 ? (
          // Empty state for mobile
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {emptyText}
            </CardContent>
          </Card>
        ) : (
          // Data cards for mobile
          data.map((record, rowIndex) => (
            <Card
              key={`mobile-row-${rowIndex}`}
              onClick={() => onRowClick?.(record, rowIndex)}
              className={cn(
                "transition-colors hover:bg-muted/50",
                onRowClick && "cursor-pointer"
              )}
            >
              <CardContent className="p-4 space-y-2">
                {mobileColumns.map((column, colIndex) => {
                  const value = getNestedValue(record, column.key as string)
                  const cellContent = column.render ? column.render(value, record, rowIndex) : String(value ?? '')
                  return (
                    <div
                      key={`mobile-cell-${rowIndex}-${colIndex}`}
                      className="flex justify-between items-start gap-2"
                    >
                      <span className="text-sm font-medium text-muted-foreground shrink-0">
                        {column.title}
                      </span>
                      <span className="text-sm text-right">
                        {canRead ? cellContent : '***'}
                      </span>
                    </div>
                  )
                })}
                {actions && (
                  <div className="pt-3 mt-2 border-t flex justify-end gap-2">
                    {actions(record, rowIndex)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {pagination && !loading && data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            Showing {((pagination.current - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onChange(pagination.current - 1)}
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
                  onClick={() => pagination.onChange(page)}
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
              onClick={() => pagination.onChange(pagination.current + 1)}
              disabled={!canNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { DataTable }
