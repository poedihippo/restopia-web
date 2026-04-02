# Dapur Coklat — Claude Code Context

## Project
Multi-branch bakery management platform. Covers POS, production,
inventory, procurement, sales, and transfers.

## Stack
- Next.js 16 (Pages Router) + React 19 + TypeScript 5
- Tailwind CSS v4 + inline CSS variables (NO Tailwind utility
  classes for color/spacing/typography in new code)
- shadcn/ui primitives available but NOT used in new views —
  all new UI is built with raw HTML + inline styles using
  CSS variables defined in src/styles/globals.css
- TanStack Query v5 for server state
- react-hook-form v7 + Zod v4 for forms
- axios for HTTP via src/hooks/useApi.ts (default export: api)
- sonner for toast notifications

## API
- Base URL proxied via Next.js rewrites: all calls go to /v1/...
- Backend OpenAPI spec: https://dc.albatech.id/v1/docs/api/openapi.yaml
- All services are in src/services/ — one file per resource
- Service methods: list(params), findById(id, params),
  create(data), update(id, data), delete(id)
- API response shape:
  r.data                    → { success, message, data }
  r.data.data               → paginated wrapper { data: [], meta: {} }
  r.data.data.data          → actual array of items
  r.data.data.meta          → { current_page, per_page, total, last_page }
- Always use .then(r => r.data) in queryFn
- Always derive: items = (data as any)?.data?.data ?? []
- Always derive: meta = (data as any)?.data?.meta

## Zod + react-hook-form Rules
- Always use z.coerce.number() for numeric fields — never z.number()
  without coerce, never z.preprocess()
- ID fields: z.coerce.number().min(1, 'Field is required')
- Price/qty fields: z.coerce.number().min(0)
- Optional numeric fields: z.coerce.number().min(0).optional()
- Always cast resolver: zodResolver(schema) as any
- Always set defaultValues for ID fields to 0 not undefined

## Design Tokens (src/styles/globals.css)
All colors, spacing, radius, and shadows use CSS variables:
  --background, --surface, --border, --border-strong
  --foreground, --foreground-muted, --foreground-subtle
  --accent (#2C1810), --accent-hover, --accent-light (#C4956A)
  --accent-light-bg, --success, --success-bg
  --warning, --warning-bg, --destructive, --destructive-bg
  --info, --info-bg, --shadow-sm, --shadow-md, --shadow-lg
  --radius-sm, --radius-md, --radius-lg, --radius-xl
  --font-sans (Instrument Sans), --font-display (Playfair Display)
  --sidebar-width (220px), --sidebar-width-collapsed (56px)
  --topbar-height (52px)

## File Structure Conventions
- src/pages/[module]/[page].tsx     → thin page file, no logic
- src/views/[Module]/index.tsx      → list view with table
- src/views/[Module]/[Name]Sheet.tsx → create/edit side sheet
- src/services/[resource].service.ts → API calls only
- src/types/api.ts                  → all shared TypeScript types

## Page Architecture
- List pages: full page data table + filters on top
- Create/Edit: side sheet (drawer from right, width 420-500px)
- Detail pages: dedicated full page for complex documents
- Simple forms (suppliers, customers, UOMs): modal or sheet
- Delete: inline confirm dialog overlay

## Component Patterns
Every list view must have:
  - Search input with 400ms debounce
  - Pagination using meta.last_page
  - Loading state (skeleton rows)
  - Empty state with icon + message
  - Delete confirm dialog
  - Sheet component for create/edit

Every sheet must have:
  - Backdrop overlay + panel sliding from right
  - Header with title + close button
  - Scrollable form body
  - Footer with Cancel + Submit buttons
  - isPending state disabling submit during mutation
  - onSuccess: invalidate query + toast + close
  - onError: toast error

## Module Build Order
Completed: Product Categories, UOMs, Products, Product UOMs,
           Product Conversions, Product Inventories, Stock Movements
Next: Purchase Orders → Productions → Sales Orders →
      Deliveries + Receipts → Recipes → Suppliers + Customers →
      Users + Roles + Branches → POS (separate layout)

## Routes (NO_LAYOUT_ROUTES — no sidebar/topbar)
  /         → Login page
  /pos      → POS layout (standalone)

## Important Constraints
- NEVER use Tailwind utility classes for color, spacing, or
  typography in any new view or component file
- NEVER use shadcn Sheet, Dialog, Table, Button in new views
- NEVER use z.number() without .coerce for form fields
- NEVER use z.preprocess() for numeric fields
- ALWAYS use inline styles with CSS variables
- ALWAYS export default from page files
- ALWAYS add 'use client' to view and sheet files
- DO NOT touch src/hooks/useAuth.tsx structure
- DO NOT add new providers to _app.tsx
