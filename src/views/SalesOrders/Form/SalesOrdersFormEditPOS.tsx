import { IProductInventories } from "@/@types/product-inventories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SalesOrderType, statusProduction, statusSalesOrders } from "@/constants/global";
import useGetCustomerList from "@/hooks/customer/useGetCustomerList";
import useGetProductInventoriesList from "@/hooks/product-inventories/useGetProductInventoriesList";
import useGetVoucherList from "@/hooks/voucher/useGetVoucherList";
import { ArrowLeft, Trash, X } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Control, Controller, FormProvider, useFormContext, useWatch, } from "react-hook-form";
import { SalesOrderFormValues, useCreateSalesOrders } from "./useCreateSalesOrders";
import { formatterIDR } from "@/helper/convertCurrency";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEditSalesOrders } from "./useEditSalesOrders";

interface CartItemProps {
  index: number;
  control: Control<SalesOrderFormValues>
  onRemove: () => void;
  productName: string
  priceEditable: boolean;
}

const CartItem = ({ control, index, onRemove, productName, priceEditable }: CartItemProps) => {
  const { setValue, getValues } = useFormContext<SalesOrderFormValues>()
  const qty = useWatch({ control, name: `details.${index}.qty` })
  const price = useWatch({ control, name: `details.${index}.price` })

  return (
    <div className="border rounded-lg p-3 flex flex-col gap-2">
      <div className="flex justify-between items-start">
        <p className="font-medium text-sm">{productName}</p>
        <button type="button" onClick={onRemove} className="text-destructive hover:text-destructive/70 cursor-pointer">
          <Trash size={14} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            autoFocus={false}
            className="border rounded w-6 h-6 flex items-center justify-center text-sm hover:bg-accent"
            onClick={() => {
              const current = getValues(`details.${index}.qty`)
              if (current > 1) setValue(`details.${index}.qty`, current - 1)
              else onRemove()
            }}
          >−</button>
          <span className="text-sm w-6 text-center">{qty}</span>
          <button
            type="button"
            tabIndex={-1}
            autoFocus={false}
            className="border rounded w-6 h-6 flex items-center justify-center text-sm hover:bg-accent"
            onClick={() => {
              const current = getValues(`details.${index}.qty`)
              setValue(`details.${index}.qty`, current + 1)
            }}
          >+</button>
        </div>
        <div>
          {priceEditable ? (
            <Controller
              control={control}
              name={`details.${index}.price`}
              render={({ field, fieldState }) => (
                <>
                  <Input
                    {...field}
                    min={0}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    type="number"
                    placeholder="0"
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error && (
                    <p className="text-destructive text-xs mt-1">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          ) : (
            <p className="text-sm font-semibold">Rp {((qty ?? 0) * (price ?? 0)).toLocaleString('id-ID')}</p>
          )}
        </div>
      </div>

      <Controller
        control={control}
        name={`details.${index}.status`}
        render={({ field, fieldState }) => (
          <>
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="h-8 text-xs w-[30%]">
                <SelectValue placeholder="Status..." />
              </SelectTrigger>
              <SelectContent>
                {statusSalesOrders?.map((item) => (
                  <SelectItem key={item.key} autoFocus={false} value={item.key}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldState.error && (
              <p className="text-destructive text-xs mt-1">
                {fieldState.error.message}
              </p>
            )}
          </>
        )}
      />

      <Controller
        control={control}
        name={`details.${index}.description`}
        render={({ field, fieldState }) => (
          <>
            <Textarea {...field} placeholder="Notes..." autoFocus={false} tabIndex={-1} className="min-h-8 resize-none text-xs" />
            {fieldState.error && (
              <p className="text-destructive text-xs mt-1">
                {fieldState.error.message}
              </p>
            )}
          </>
        )}
      />
    </div>
  )
}

interface Props {
  id: number;
}

const SalesOrdersFormEditPOS = ({ id }: Props) => {
  const router = useRouter();
  const {
    form,
    handleSubmit,
    appendDetail,
    detailFields,
    isSubmitting,
    removeDetail,
  } = useEditSalesOrders({ id });

  const [search, setSearch] = useState('')
  const [debounceSearch, setDebounceSearch] = useState('')
  const [priceMap, setPriceMap] = useState<Map<number, { base_price: number, online_price: number, price_editable: boolean }>>(new Map())
  const [isNewCustomer, setIsNewCustomer] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const cartRef = useRef<HTMLDivElement>(null)
  const watchAll = form.watch()


  useEffect(() => {
    const timer = setTimeout(() => setDebounceSearch(search), 500)
    return () => clearTimeout(timer)
  }, [search])

  const { data: productInventoryData, isLoading: isLoadingProductInventory } =
    useGetProductInventoriesList({
      include: "branch,product_uom",
      filter: {
        search: debounceSearch
      }
    }, { enabled: true })

  const { data: customerData, isLoading: isLoadingCustomer } =
    useGetCustomerList(
      {
        enabled: true,
      },
    );
  const watcherCustomerId = form.watch('customer_id')


  useEffect(() => {
    const selected = customerData?.data?.find((data) => data.id === watcherCustomerId)
    if (selected) {
      form.setValue('customer_name', selected?.name ?? '-')
      form.setValue('customer_phone', selected?.phone ?? '-')
    } else {
      form.setValue('customer_name', '')
      form.setValue('customer_phone', '')
    }
  }, [customerData, watcherCustomerId, form])

  const { data: voucherData, isLoading: isLoadingVoucher } =
    useGetVoucherList(
      {
        filter: {
          status: 'active'
        }
      },
      {
        enabled: true,
      },
    );

  const handleAddToCart = (item: IProductInventories) => {
    const existingIndex = detailFields.findIndex(f => f.product_inventory_id === item.id)

    if (existingIndex >= 0) {
      const currentQty = form.getValues(`details.${existingIndex}.qty`)
      if (currentQty < (item.stock ?? Infinity)) {
        form.setValue(`details.${existingIndex}.qty`, currentQty + 1)
      }
    } else {
      setPriceMap(prev => new Map(prev).set(item.id, {
        base_price: item.base_price ?? 0,
        online_price: item.online_price ?? 0,
        price_editable: item.price_editable ?? false
      }))
      appendDetail({
        product_inventory_id: item.id,
        qty: 1,
        price: item.base_price ?? 0,
        status: '',
        description: ""
      }, { shouldFocus: false })

      setTimeout(() => {
        (document.activeElement as HTMLElement)?.blur()
      }, 0)
    }
  }

  useEffect(() => {
    detailFields.forEach((field, index) => {
      const prices = priceMap.get(field.product_inventory_id)
      if (!prices) return;

      const newPrice = watchAll.type === 'offline' ? prices.base_price : prices.online_price
      form.setValue(`details.${index}.price`, newPrice)
    })
  }, [watchAll.type])

  return (
    <FormProvider {...form}>
      <div className="w-full">
        <div className="flex gap-4 mb-4">
          <button onClick={() => router.back()} className="cursor-pointer">
            <ArrowLeft />
          </button>
          <p className="font-semibold text-2xl">Back</p>
        </div>

        <div className="flex gap-0 overflow-hidden">
          <div className="w-[55%] overflow-y-auto bg-muted/40 p-4 rounded-lg">
            <Input placeholder="Search product..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-2">
              {isLoadingProductInventory && <p className="text-muted-foreground text-sm">Loading...</p>}
              {productInventoryData?.data?.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleAddToCart(item)}
                  disabled={!item.stock || item.stock <= 0}
                  className="border rounded-lg p-3 text-left hover:bg-accent transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <p className="font-medium text-sm">{item.product_uom?.product?.name}</p>
                  <p className="text-xs text-muted-foreground">{item.product_uom?.uom?.code}</p>
                  <p className="text-sm font-semibold mt-1">Base: Rp {item.base_price?.toLocaleString('id-ID')}</p>
                  <p className="text-sm font-semibold mt-1">Online: Rp {item.online_price?.toLocaleString('id-ID')}</p>
                  <p className="text-xs text-muted-foreground">Stock: {item.stock}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="w-[45%] flex flex-col bg-background border border-border rounded-xl shadow-sm p-4">
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 shrink-0">
                <div className="flex gap-4 justify-center">
                  <div className="flex flex-col gap-2 w-full">
                    <Label>Code</Label>
                    <Controller
                      control={form.control}
                      name="code"
                      render={({ field, fieldState }) => (
                        <>
                          <Input
                            {...field}
                            placeholder="John Doe"
                            aria-invalid={!!fieldState.error}
                          />
                          {fieldState.error && (
                            <p className="text-destructive text-sm">
                              {fieldState.error.message}
                            </p>
                          )}
                        </>
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <Label>Date</Label>
                    <Controller
                      control={form.control}
                      name="date"
                      render={({ field, fieldState }) => (
                        <>
                          <Input
                            {...field}
                            type="date"
                            placeholder="John Doe"
                            aria-invalid={!!fieldState.error}
                          />
                          {fieldState.error && (
                            <p className="text-destructive text-sm">
                              {fieldState.error.message}
                            </p>
                          )}
                        </>
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <Label>Type</Label>
                    <Controller
                      control={form.control}
                      name="type"
                      render={({ field, fieldState }) => (
                        <>
                          <div className="flex gap-2">
                            <Select
                              onValueChange={(value) => {
                                field.onChange(value);
                              }}
                              value={field.value}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a type" />
                              </SelectTrigger>
                              <SelectContent>
                                {SalesOrderType?.map((item) => (
                                  <SelectItem key={item.key} value={item.key}>
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {field.value && (
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => field.onChange("")}
                                className="shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {fieldState.error && (
                            <p className="text-destructive text-sm">
                              {fieldState.error.message}
                            </p>
                          )}
                        </>
                      )}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <Label>Customer</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewCustomer(!isNewCustomer)
                        form.setValue('customer_name', '')
                        form.setValue('customer_phone', '')
                      }}
                      className="text-xs text-primary underline cursor-pointer"
                    >
                      {isNewCustomer ? 'Choose existing' : '+ New customer'}
                    </button>
                  </div>
                  {isNewCustomer ? (
                    <div className="flex gap-2">
                      <Controller
                        control={form.control}
                        name="customer_name"
                        render={({ field }) => <Input {...field} placeholder="Customer name" />}
                      />
                      <Controller
                        control={form.control}
                        name="customer_phone"
                        render={({ field }) => <Input {...field} placeholder="Phone" />}
                      />
                    </div>
                  ) : (
                    <Controller
                      control={form.control}
                      name={`customer_id`}
                      render={({ field, fieldState }) => (
                        <>
                          <SearchableSelect
                            isClearable
                            isLoading={isLoadingCustomer}
                            placeholder="Select customer..."
                            options={
                              customerData?.data?.map((item) => ({
                                value: item.id,
                                label: `${item?.name}`,
                              })) ?? []
                            }
                            value={
                              customerData?.data
                                ?.filter((item) => item.id === field.value)
                                .map((item) => ({
                                  value: item.id,
                                  label: `${item?.name}`,
                                }))[0] ?? null
                            }
                            onChange={(selected) => {
                              field.onChange(
                                selected ? (selected as { value: number }).value : 0,
                              );
                            }}
                          />
                          {fieldState.error && (
                            <p className="text-destructive text-sm">
                              {fieldState.error.message}
                            </p>
                          )}
                        </>
                      )}
                    />)}

                </div>
                <div className="flex flex-col gap-2">
                  <Label>Choose Voucher</Label>
                  <Controller
                    control={form.control}
                    name={`voucher_id`}
                    render={({ field, fieldState }) => (
                      <>
                        <SearchableSelect
                          isClearable
                          isLoading={isLoadingVoucher}
                          placeholder="Select voucher..."
                          options={
                            voucherData?.data?.map((item) => ({
                              value: item.id,
                              label: `${item?.name}`,
                            })) ?? []
                          }
                          value={
                            voucherData?.data
                              ?.filter((item) => item.id === field.value)
                              .map((item) => ({
                                value: item.id,
                                label: `${item?.name}`,
                              }))[0] ?? null
                          }
                          onChange={(selected) => {
                            field.onChange(
                              selected ? (selected as { value: number }).value : 0,
                            );
                          }}
                        />
                        {fieldState.error && (
                          <p className="text-destructive text-sm">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>
              </div>

              <div ref={cartRef} className="flex flex-col gap-2 overflow-y-auto min-h-0 h-1/2" style={{ overflowAnchor: 'none' }}>
                {detailFields.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">No items added yet</p>
                )}
                {detailFields.map((field, index) => {
                  const productId = form.getValues(`details.${index}.product_inventory_id`)
                  const product = productInventoryData?.data?.find(p => p.id === productId)
                  return (
                    <CartItem
                      key={field.id}
                      index={index}
                      control={form.control}
                      onRemove={() => {
                        const productId = form.getValues(`details.${index}.product_inventory_id`)
                        setPriceMap((prev) => {
                          const next = new Map(prev)
                          next.delete(productId)
                          return next;
                        })
                        removeDetail(index)
                      }}
                      productName={product?.product_uom?.product?.name ?? 'Unknown Product'}
                      priceEditable={priceMap.get(field.product_inventory_id)?.price_editable ?? false}
                    />
                  )
                })}
              </div>

              <div className="flex flex-col gap-4 shrink-0">
                <div className="flex flex-row justify-between">
                  <Label>Subtotal Price</Label>
                  <Label className="text-lg font-semibold">{formatterIDR(form.watch('subtotal_price') ?? 0)}</Label>
                </div>
                <div className="flex flex-row justify-between">
                  <Label>Discount Price</Label>
                  <Controller
                    control={form.control}
                    name={`discount_price`}
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          className="w-[25%]"
                          {...field}
                          min={0}
                          onChange={(e) => field.onChange(e.target.valueAsNumber)}
                          type="number"
                          placeholder="0"
                          aria-invalid={!!fieldState.error}
                        />
                        {fieldState.error && (
                          <p className="text-destructive text-sm">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>
                <div className="flex flex-row justify-between">
                  <Label>Total Price</Label>
                  <Label className="text-lg font-semibold">{formatterIDR(form.watch('total_price') ?? 0)}</Label>
                </div>
                <div className="flex flex-row justify-between">
                  <Label>Status</Label>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field, fieldState }) => (
                      <>
                        <div className="flex gap-2">
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                            }}
                            value={field.value}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                            <SelectContent>
                              {statusProduction?.map((item) => (
                                <SelectItem key={item.key} value={item.key}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {field.value && (
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => field.onChange("")}
                              className="shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {fieldState.error && (
                          <p className="text-destructive text-sm">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Description</Label>
                  <Controller
                    control={form.control}
                    name="description"
                    render={({ field, fieldState }) => (
                      <>
                        <Textarea
                          {...field}
                          placeholder="John Doe"
                          aria-invalid={!!fieldState.error}
                        />
                        {fieldState.error && (
                          <p className="text-destructive text-sm">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>
                <div className="flex flex-row justify-between">
                  <Label>Fulfillment Date</Label>
                  <Controller
                    control={form.control}
                    name="fulfillment_date"
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          {...field}
                          className="w-[30%]"
                          type="datetime-local"
                          placeholder="John Doe"
                          aria-invalid={!!fieldState.error}
                        />
                        {fieldState.error && (
                          <p className="text-destructive text-sm">
                            {fieldState.error.message}
                          </p>
                        )}
                      </>
                    )}
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => setShowConfirm(true)}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  Submit
                </Button>
              </div>

              <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Order</DialogTitle>
                  </DialogHeader>

                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Code</span>
                      <span>{watchAll.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{watchAll.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer</span>
                      <span>{watchAll.customer_name || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Items</span>
                      <span>{watchAll.details?.length} item(s)</span>
                    </div>
                    {watchAll.details?.map((d, i) => {
                      const product = productInventoryData?.data?.find(p => p.id === d.product_inventory_id)
                      return (
                        <div key={i} className="flex justify-between pl-4">
                          <div className="flex flex-col">
                            <span>{product?.product_uom?.product?.name} x{d.qty}</span>
                            {d.status && <span>&bull; {d.status}</span>}
                            {d.description && <span>&bull; {d.description}</span>}
                          </div>
                          <span>Rp {((d.qty ?? 0) * (d.price ?? 0)).toLocaleString('id-ID')}</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between font-semibold border-t pt-2">
                      <span>Total</span>
                      <span>Rp {watchAll.total_price?.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowConfirm(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={isSubmitting}
                      className="bg-green-500 hover:bg-green-600 text-white"
                      onClick={() => {
                        setShowConfirm(false)
                        form.handleSubmit(handleSubmit)()
                      }}
                    >
                      Confirm
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </form>
          </div>
        </div>
      </div>
    </FormProvider>
  );
};



export default SalesOrdersFormEditPOS;
