const fs = require('fs');
const path = require('path');

const bundleFile = path.join(__dirname, 'src/views/Bundles/BundleSheet.tsx');
let bundleData = fs.readFileSync(bundleFile, 'utf8');

// 1. Zod schema
if (!bundleData.includes('description: z.string().optional()')) {
  bundleData = bundleData.replace(
    /status: z\.enum\(\['active', 'inactive'\], \{ message: 'Status is required' \}\),/,
    "status: z.enum(['active', 'inactive'], { message: 'Status is required' }),\n  description: z.string().optional(),"
  );
}

// 2. Default values
// In the current file (since it was reverted), let's look for how `defaultValues` are defined.
// If it doesn't have description, add it.
if (bundleData.includes('price: 0,') && !bundleData.includes("description: ''")) {
    bundleData = bundleData.replace(
      /price: 0,/,
      "price: 0,\n      description: '',"
    );
}

// 3. Form field for description
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
`;
// Insert before Details section if not already present
if (!bundleData.includes('register(\'description\')')) {
  bundleData = bundleData.replace(
    /(<div style=\{\{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' \}\}>\s*<label.*?Details<\/label>)/,
    `${bundleField}\n            $1`
  );
}

fs.writeFileSync(bundleFile, bundleData);
console.log('Fixed BundleSheet.tsx');
