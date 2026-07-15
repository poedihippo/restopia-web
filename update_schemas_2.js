const fs = require('fs');
const path = require('path');

// --- 3. PurchaseOrderForm.tsx ---
const poFile = path.join(__dirname, 'src/views/PurchaseOrders/PurchaseOrderForm.tsx');
let poData = fs.readFileSync(poFile, 'utf8');

poData = poData.replace(
  /status: z\.string\(\)\.optional\(\),/,
  "status: z.string().optional(),\n  type: z.string().optional(),\n  total_price: z.coerce.number().optional(),"
);

poData = poData.replace(
  /status: 'pending',/,
  "status: 'pending',\n      type: 'standard',\n      total_price: 0,"
);

poData = poData.replace(
  /status: editData\.status \?\? 'pending',/,
  "status: editData.status ?? 'pending',\n        type: editData.type ?? 'standard',\n        total_price: editData.total_price ?? 0,"
);

poData = poData.replace(
  /status: 'pending',\s+description: '',/,
  "status: 'pending',\n        type: 'standard',\n        total_price: 0,\n        description: '',"
);

const poField = `
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Type</label>
                <select
                  {...register('type')}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="standard">Standard</option>
                  <option value="urgent">Urgent</option>
                </select>
                {errors.type && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.type.message as string}</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Total Price (Auto-calculated / Override)</label>
                <input
                  {...register('total_price')} type="number"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
                {errors.total_price && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.total_price.message as string}</span>}
              </div>
`;

poData = poData.replace(
  /(<div style=\{\{ display: 'flex', flexDirection: 'column', gap: 6 \}\}>\s*<label.*?Status<\/label>)/,
  `${poField}\n              $1`
);
fs.writeFileSync(poFile, poData);


// --- 4. ReceiptForm.tsx ---
const receiptFile = path.join(__dirname, 'src/views/Receipts/ReceiptForm.tsx');
let receiptData = fs.readFileSync(receiptFile, 'utf8');

receiptData = receiptData.replace(
  /status: z\.string\(\)\.optional\(\),/,
  "status: z.string().optional(),\n  total_price: z.coerce.number().optional(),"
);

receiptData = receiptData.replace(
  /status: 'pending',/,
  "status: 'pending',\n      total_price: 0,"
);

receiptData = receiptData.replace(
  /status: editData\.status \?\? 'pending',/,
  "status: editData.status ?? 'pending',\n        total_price: editData.total_price ?? 0,"
);

receiptData = receiptData.replace(
  /status: 'pending',\s+description: '',/,
  "status: 'pending',\n        total_price: 0,\n        description: '',"
);

const receiptField = `
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Total Price</label>
                <input
                  {...register('total_price')} type="number"
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
                {errors.total_price && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.total_price.message as string}</span>}
              </div>
`;

receiptData = receiptData.replace(
  /(<div style=\{\{ display: 'flex', flexDirection: 'column', gap: 6 \}\}>\s*<label.*?Status<\/label>)/,
  `${receiptField}\n              $1`
);
fs.writeFileSync(receiptFile, receiptData);

console.log('Done Phase 2');
