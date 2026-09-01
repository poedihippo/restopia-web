const fs = require('fs');
const file = 'c:/dapur-cokelat-web/src/views/PurchaseOrders/PurchaseOrderForm.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  /    formState: \{ errors \},\r?\n    \},\r?\n  \}\)/g,
  `    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      supplier_id: 0,
      supplier_branch_id: undefined,
      date: new Date().toISOString().split('T')[0],
      fulfillment_date: new Date().toISOString().split('T')[0],
      status: 'pending',
      description: '',
      details: [{ product_uom_id: 0, qty: 1, price: 0, description: '', is_price_locked: true, is_taxable: true }],
      additional_charges: [],
      type: 'supplier',
      tax_id: undefined,
      total_price: 0,
    },
  })`
);
fs.writeFileSync(file, content);
console.log('Fixed useForm');
