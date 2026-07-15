const fs = require('fs');
const path = require('path');

// --- 1. BranchSheet.tsx ---
const branchFile = path.join(__dirname, 'src/views/Branches/BranchSheet.tsx');
let branchData = fs.readFileSync(branchFile, 'utf8');

// Update Zod schema
branchData = branchData.replace(
  /name: z\.string\(\)\.min\(1, 'Name is required'\),/,
  "name: z.string().min(1, 'Name is required'),\n  timezone: z.string().optional(),"
);
// Update default values
branchData = branchData.replace(
  /name: '',/,
  "name: '',\n      timezone: 'Asia/Jakarta',"
);
// Update useEffect reset
branchData = branchData.replace(
  /name: editData\.name \?\? '',/,
  "name: editData.name ?? '',\n        timezone: editData.timezone ?? 'Asia/Jakarta',"
);
branchData = branchData.replace(
  /name: '',\s+is_default/,
  "name: '',\n        timezone: 'Asia/Jakarta',\n        is_default"
);

// Add form field
const branchField = `
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Timezone</label>
              <input
                {...register('timezone')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                placeholder="Asia/Jakarta"
              />
              {errors.timezone && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.timezone.message as string}</span>}
            </div>
`;
branchData = branchData.replace(
  /(<div style=\{\{ display: 'flex', flexDirection: 'column', gap: 6 \}\}>\s*<label.*?is_default.*?<\/label>)/,
  `${branchField}\n            $1`
);

fs.writeFileSync(branchFile, branchData);


// --- 2. BundleSheet.tsx ---
const bundleFile = path.join(__dirname, 'src/views/Bundles/BundleSheet.tsx');
let bundleData = fs.readFileSync(bundleFile, 'utf8');

bundleData = bundleData.replace(
  /price: z\.coerce\.number\(\)\.min\(0, 'Price must be greater than or equal to 0'\),/,
  "price: z.coerce.number().min(0, 'Price must be greater than or equal to 0'),\n  description: z.string().optional(),\n  status: z.string().optional(),\n  details: z.array(z.any()).optional(),"
);

bundleData = bundleData.replace(
  /price: 0,/,
  "price: 0,\n      description: '',\n      status: 'active',\n      details: [],"
);

bundleData = bundleData.replace(
  /price: editData\.price \?\? 0,/,
  "price: editData.price ?? 0,\n        description: editData.description ?? '',\n        status: editData.status ?? 'active',\n        details: editData.details ?? [],"
);

bundleData = bundleData.replace(
  /price: 0\s*\}\)/,
  "price: 0,\n        description: '',\n        status: 'active',\n        details: [],\n      })"
);

const bundleField = `
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Description</label>
              <textarea
                {...register('description')}
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
              />
              {errors.description && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.description.message as string}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Status</label>
              <select
                {...register('status')}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'var(--surface)', color: 'var(--foreground)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              {errors.status && <span style={{ fontSize: 12, color: 'var(--destructive)' }}>{errors.status.message as string}</span>}
            </div>
`;
bundleData = bundleData.replace(
  /(<div style=\{\{ padding: '16px 24px', borderTop: '1px solid var\(--border\)',)/,
  `${bundleField}\n          </div>\n          $1`
);
fs.writeFileSync(bundleFile, bundleData);

console.log('Done Phase 1');
