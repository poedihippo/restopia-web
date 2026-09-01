const fs = require('fs');
const file = 'c:/dapur-cokelat-web/src/views/PurchaseOrders/PurchaseOrderForm.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update detailSchema
content = content.replace(
  /is_price_locked: z\.boolean\(\)\.optional\(\),\n}\)/,
  "is_price_locked: z.boolean().optional(),\n  is_taxable: z.boolean().optional(),\n})"
);

// 2. Update schema (additional_charges tax_id removal and adding tax_id)
content = content.replace(
  /amount: z\.coerce\.number\(\)\.min\(0, 'Amount must be >= 0'\),\n    tax_id: z\.coerce\.number\(\)\.optional\(\),\n    description: z\.string\(\)\.optional\(\),\n  }\)\)\.optional\(\),\n  type: z\.string\(\)\.min\(1, 'Type is required'\),\n  total_price: z\.coerce\.number\(\)\.optional\(\),/,
  "amount: z.coerce.number().min(0, 'Amount must be >= 0'),\n    description: z.string().optional(),\n  })).optional(),\n  type: z.string().min(1, 'Type is required'),\n  tax_id: z.coerce.number().optional(),\n  total_price: z.coerce.number().optional(),"
);

// 3. Update defaultValues
content = content.replace(
  /status: 'pending',\n      description: '',\n      details: \[\{ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true \}\],\n      additional_charges: \[\],\n      type: 'supplier',\n      total_price: 0,/,
  "status: 'final',\n      description: '',\n      details: [{ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true, is_taxable: true }],\n      additional_charges: [],\n      type: 'supplier',\n      tax_id: undefined,\n      total_price: 0,"
);

// 4. Update calculations
content = content.replace(
  /const watchDetails = watch\('details'\)\n  const watchSupplierId = watch\('supplier_id'\)\n  const watchAdditionalCharges = watch\('additional_charges'\) \|\| \[\]\n\n  const subtotal = watchDetails\.reduce\(\(sum, d\) => sum \+ Number\(d\.qty \|\| 0\) \* Number\(d\.price \|\| 0\), 0\)\n  const additionalChargesTotal = watchAdditionalCharges\.reduce\(\(sum, c\) => sum \+ Number\(c\.amount \|\| 0\), 0\)\n  const totalPrice = subtotal \+ additionalChargesTotal/,
  `const watchDetails = watch('details')
  const watchSupplierId = watch('supplier_id')
  const watchAdditionalCharges = watch('additional_charges') || []
  const watchTaxId = watch('tax_id')

  const { data: taxesData } = useQuery({
    queryKey: ['taxes'],
    queryFn: () => taxesService.list({ per_page: 50 }).then((r) => r.data),
  })
  const taxes = (taxesData as any)?.data ?? []

  const selectedTax = taxes.find((t: any) => t.id === watchTaxId)
  const taxRate = selectedTax?.rate ?? 0

  const taxableSubtotal = watchDetails.reduce((sum, d) => sum + (d.is_taxable !== false ? Number(d.qty || 0) * Number(d.price || 0) : 0), 0)
  const nonTaxableSubtotal = watchDetails.reduce((sum, d) => sum + (d.is_taxable === false ? Number(d.qty || 0) * Number(d.price || 0) : 0), 0)
  const subtotal = taxableSubtotal + nonTaxableSubtotal
  const taxAmount = (taxableSubtotal * taxRate) / 100
  const additionalChargesTotal = watchAdditionalCharges.reduce((sum, c) => sum + Number(c.amount || 0), 0)
  const totalPrice = subtotal + taxAmount + additionalChargesTotal`
);

// Remove the now-duplicate taxesData query
content = content.replace(
  /  const \{ data: taxesData \} = useQuery\(\{\n    queryKey: \['taxes'\],\n    queryFn: \(\) => taxesService\.list\(\{ per_page: 50 \}\)\.then\(\(r\) => r\.data\),\n  \}\)\n  const taxes = \(taxesData as any\)\?\.data \?\? \[\]\n\n\n/,
  ""
);

// 5. Update handleImportRecipes
content = content.replace(
  /finalDetails\.push\(\{ product_uom_id: id, qty, price, description: '', is_price_locked: true \}\)/g,
  "finalDetails.push({ product_uom_id: id, qty, price, description: '', is_price_locked: true, is_taxable: true })"
);
content = content.replace(
  /cleanedDetails\.push\(\{ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true \}\)/g,
  "cleanedDetails.push({ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true, is_taxable: true })"
);

// 6. buildPayload
content = content.replace(
  /        qty: d\.qty,\n        price: d\.price,\n        description: d\.description \|\| undefined,/,
  "        qty: d.qty,\n        price: d.price,\n        is_taxable: d.is_taxable,\n        description: d.description || undefined,"
);

// 7. Add tax to buildPayload
content = content.replace(
  /    type: values\.type,\n    supplier_id:/,
  "    type: values.type,\n    tax_id: values.tax_id,\n    supplier_id:"
);

// 8. Add tax select to Order Details (after Supplier Branch)
content = content.replace(
  /<\/Controller>\n              <\/div>\n            \)}\n\n            {\/\* Status \*\/}/,
  `</Controller>
              </div>
            )}

            {/* Tax */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 2 }}>
                Tax
              </label>
              <Controller
                name="tax_id"
                control={control}
                render={({ field }) => (
                  <select
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    style={selectStyle}
                  >
                    <option value="">No Tax</option>
                    {taxes.map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.rate}%)</option>
                    ))}
                  </select>
                )}
              />
            </div>

            {/* Status */}`
);

// 9. Line items append button
content = content.replace(
  /append\(\{ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true \}\)/g,
  "append({ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true, is_taxable: true })"
);

// 10. Column headers
content = content.replace(
  /gridTemplateColumns: watchType === 'branch' \? '2fr 100px 1fr 40px' : '2fr 100px 160px 1fr 40px',/g,
  "gridTemplateColumns: watchType === 'branch' ? '2fr 100px 1fr 40px' : '2fr 100px 160px 80px 1fr 40px',"
);
content = content.replace(
  /\(watchType === 'branch' \? \['Product \/ UOM', 'Qty', 'Notes', ''\] : \['Product \/ UOM', 'Qty', 'Unit Price', 'Notes', ''\]\)/g,
  "(watchType === 'branch' ? ['Product / UOM', 'Qty', 'Notes', ''] : ['Product / UOM', 'Qty', 'Unit Price', 'Taxable', 'Notes', ''])"
);

// 11. Add taxable checkbox inside row map
const taxableCheckboxHtml = `
              {/* Taxable Checkbox */}
              {watchType !== 'branch' && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
                  <input
                    type="checkbox"
                    {...register(\`details.\${index}.is_taxable\`)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                </div>
              )}

              {/* Description */}`;
content = content.replace(
  /              {\/\* Description \*\/}/,
  taxableCheckboxHtml
);

// 12. Additional Charges UI
content = content.replace(
  /          {\/\* Additional Charges \*\/}\n          <div style={{ marginTop: 32, marginBottom: 16 }}>\n            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var\(--foreground\)', marginBottom: 12 }}>\n              Additional Charges\n            <\/h3>[\s\S]*?<button\n              type="button"\n              onClick=\{.*?\}\n              style=\{\{[\s\S]*?\}\}\n            >\n              <Plus size=\{14\} \/> Add Charge\n            <\/button>\n          <\/div>/,
  `          {/* Additional Charges */}
          <div style={{ marginTop: 24, marginBottom: 16, padding: '0 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground-muted)', letterSpacing: '0.5px', margin: 0, textTransform: 'uppercase' }}>
                Additional Charges
              </h3>
              <button
                type="button"
                onClick={() => appendCharge({ name: '', amount: 0 })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} /> Add Charge
              </button>
            </div>
            {chargeFields.length > 0 && (
              <div style={{ display: 'grid', gap: 10 }}>
                {chargeFields.map((field, index) => (
                  <div key={field.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ flex: 2 }}>
                      <input
                        {...register(\`additional_charges.\${index}.name\`)}
                        placeholder="Charge Name *"
                        style={lineInputStyle}
                      />
                      {errors.additional_charges?.[index]?.name && (
                        <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{errors.additional_charges[index].name.message}</span>
                      )}
                    </div>
                    <div style={{ flex: 1.5 }}>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--foreground-muted)' }}>Rp</span>
                        <input
                          type="number"
                          min="0"
                          {...register(\`additional_charges.\${index}.amount\`, { valueAsNumber: true })}
                          placeholder="Amount *"
                          style={{ ...lineInputStyle, paddingLeft: 32 }}
                        />
                      </div>
                      {errors.additional_charges?.[index]?.amount && (
                        <span style={{ fontSize: 11, color: 'var(--destructive)' }}>{errors.additional_charges[index].amount.message}</span>
                      )}
                    </div>
                    <div style={{ flex: 2 }}>
                      <input
                        {...register(\`additional_charges.\${index}.description\`)}
                        placeholder="Optional Note"
                        style={lineInputStyle}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCharge(index)}
                      style={{ padding: '8px 6px', background: 'none', border: 'none', color: 'var(--destructive)', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>`
);

// 13. Total Row updates
content = content.replace(
  /              <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var\(--foreground-muted\)' }}>\n                <span>Additional Charges:<\/span>\n                <span><PriceDisplay amount=\{additionalChargesTotal\} prefix="Rp " \/><\/span>\n              <\/div>/,
  `              {taxAmount > 0 && (
                <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--foreground-muted)' }}>
                  <span>Tax ({taxRate}%):</span>
                  <span><PriceDisplay amount={taxAmount} prefix="Rp " /></span>
                </div>
              )}
              {additionalChargesTotal > 0 && (
                <div style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--foreground-muted)' }}>
                  <span>Additional Charges:</span>
                  <span><PriceDisplay amount={additionalChargesTotal} prefix="Rp " /></span>
                </div>
              )}`
);

fs.writeFileSync(file, content);
console.log("Done");
