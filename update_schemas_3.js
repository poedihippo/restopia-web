const fs = require('fs');
const path = require('path');

// --- 5. StockMovementSheet.tsx ---
const smFile = path.join(__dirname, 'src/views/StockMovement/StockMovementSheet.tsx');
let smData = fs.readFileSync(smFile, 'utf8');

smData = smData.replace(
  /qty: z\.coerce\.number\(\)\.min\(1, 'Quantity must be greater than 0'\),/,
  "qty: z.coerce.number().min(1, 'Quantity must be greater than 0'),\n  product_uom_batch_id: z.coerce.number().optional(),\n  reference_id: z.coerce.number().optional(),\n  reference_type: z.string().optional(),"
);

smData = smData.replace(
  /qty: 1,/,
  "qty: 1,\n      product_uom_batch_id: 0,\n      reference_id: 0,\n      reference_type: '',"
);

smData = smData.replace(
  /qty: editData\.qty \?\? 1,/,
  "qty: editData.qty ?? 1,\n        product_uom_batch_id: editData.product_uom_batch_id ?? 0,\n        reference_id: editData.reference_id ?? 0,\n        reference_type: editData.reference_type ?? '',"
);

smData = smData.replace(
  /qty: 1,\s+direction: 'in',/,
  "qty: 1,\n        product_uom_batch_id: 0,\n        reference_id: 0,\n        reference_type: '',\n        direction: 'in',"
);

const smField = `
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Product UOM Batch ID (Optional)</label>
              <input
                {...register('product_uom_batch_id')} type="number"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.product_uom_batch_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.product_uom_batch_id.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Reference ID (Optional)</label>
              <input
                {...register('reference_id')} type="number"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.reference_id && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.reference_id.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Reference Type (Optional)</label>
              <input
                {...register('reference_type')}
                placeholder="e.g. SalesOrder, Delivery"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {errors.reference_type && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.reference_type.message as string}</span>}
            </div>
`;
smData = smData.replace(
  /(<div style=\{\{ display: 'flex', flexDirection: 'column', gap: 6 \}\}>\s*<label.*?Direction<\/label>)/,
  `${smField}\n            $1`
);
fs.writeFileSync(smFile, smData);


// --- 6. VoucherSheet.tsx ---
const voucherFile = path.join(__dirname, 'src/views/Vouchers/VoucherSheet.tsx');
let vData = fs.readFileSync(voucherFile, 'utf8');

vData = vData.replace(
  /description: z\.string\(\)\.optional\(\)/,
  "description: z.string().optional(),\n  branches: z.array(z.coerce.number()).optional(),\n  product_uoms: z.array(z.coerce.number()).optional()"
);

vData = vData.replace(
  /description: '',\s+\}\)/,
  "description: '',\n      branches: [],\n      product_uoms: [],\n    })"
);

vData = vData.replace(
  /description: editData\.description \?\? '',\s+\}\)/,
  "description: editData.description ?? '',\n        branches: editData.branches ?? [],\n        product_uoms: editData.product_uoms ?? [],\n      })"
);

vData = vData.replace(
  /description: '',\s+\}\)/,
  "description: '',\n        branches: [],\n        product_uoms: [],\n      })"
);

const vField = `
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Branches (Comma separated IDs)</label>
              <input
                onChange={(e) => {
                  const vals = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                  reset({ ...control._formValues, branches: vals });
                }}
                defaultValue={control._formValues.branches?.join(', ')}
                placeholder="1, 2, 3"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Product UOMs (Comma separated IDs)</label>
              <input
                onChange={(e) => {
                  const vals = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                  reset({ ...control._formValues, product_uoms: vals });
                }}
                defaultValue={control._formValues.product_uoms?.join(', ')}
                placeholder="4, 5, 6"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
`;
// Vouchers has many fields, I'll put this right before Description
vData = vData.replace(
  /(<div style=\{\{ display: 'flex', flexDirection: 'column', gap: 6 \}\}>\s*<label.*?Description<\/label>)/,
  `${vField}\n            $1`
);
fs.writeFileSync(voucherFile, vData);

console.log('Done Phase 3');
