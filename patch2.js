const fs = require('fs');
const file = 'c:/dapur-cokelat-web/src/views/PurchaseOrders/PurchaseOrderForm.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update detailSchema
content = content.replace(
  /is_price_locked: z\.boolean\(\)\.optional\(\),\r?\n}\)/g,
  "is_price_locked: z.boolean().optional(),\n  is_taxable: z.boolean().optional(),\n})"
);

fs.writeFileSync(file, content);
console.log("Done");
