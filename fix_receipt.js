const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/views/Receipts/ReceiptForm.tsx');
let data = fs.readFileSync(file, 'utf8');

const field = `
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

data = data.replace(
  /(<\/div>\s*<div style=\{\{ padding: '16px 24px', borderTop: '1px solid var\(--border\)',)/,
  `${field}\n        $1`
);
fs.writeFileSync(file, data);
