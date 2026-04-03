# # Dapur Coklat — Claude Code Context

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

## Agent Instructions

This project uses a shared prompt format that works across any
AI coding agent (Cursor Agent, OpenAI Codex, GitHub Copilot
Workspace, Aider, Claude Code). Always follow this format.

### Prompt Format
Every task given to the agent follows this exact structure:

GOAL:
(one sentence — what the task achieves)

FILES:
(explicit list of files to create or modify — no searching)

CHANGES:
(step-by-step mechanical instructions)

CONSTRAINTS:
(strict rules — what NOT to touch)

OUTPUT:
(what to return or confirm)

### Agent Rules
- Tasks are ATOMIC — one goal per prompt, never combine goals
- File paths are ALWAYS explicit — never search for files
- Read every listed file fully BEFORE making any changes
- Apply changes exactly as described — no improvisation
- Do NOT modify files not listed in FILES
- Do NOT add features, refactor, or clean up beyond the task
- If a file does not exist and is not in FILES as CREATE,
  do not create it
- If instructions conflict with existing code, follow the
  instructions and flag the conflict in your response

### Stack Conventions (must follow in every code change)
- NO Tailwind utility classes for color, spacing, typography
  in any view or component — use inline styles + CSS variables
- NO shadcn primitives in new views — raw HTML + inline styles
- NO z.number() without .coerce — always z.coerce.number()
- NO z.preprocess() for numeric fields
- NO z.number({ required_error }) or z.number({ invalid_type_error })
  — use z.coerce.number({ message: '...' }) or just z.coerce.number()
- ALWAYS cast zodResolver: resolver: zodResolver(schema) as any
- ALWAYS cast service calls: xService.create(data as any)
- ALWAYS use .then(r => r.data) in queryFn
- ALWAYS derive items as: (data as any)?.data?.data ?? []
- ALWAYS derive meta as: (data as any)?.data?.meta
- ALWAYS add 'use client' to view and sheet files
- ALWAYS export default from page files in src/pages/

### CSS Variable Reference
Use these variables for ALL styling — never hardcode colors:
  Backgrounds : --background, --surface, --surface-raised
  Borders     : --border, --border-strong
  Text        : --foreground, --foreground-muted, --foreground-subtle
  Accent      : --accent, --accent-hover, --accent-light,
                --accent-light-bg
  Status      : --success, --success-bg, --warning, --warning-bg,
                --destructive, --destructive-bg, --info, --info-bg
  Shadows     : --shadow-sm, --shadow-md, --shadow-lg
  Radius      : --radius-sm, --radius-md, --radius-lg, --radius-xl
  Typography  : --font-sans, --font-display
  Layout      : --sidebar-width, --sidebar-width-collapsed,
                --topbar-height

### Sheet Component Pattern
Every create/edit sheet must follow this structure:
  1. Backdrop: position fixed, inset 0, zIndex 40
  2. Overlay: position absolute, inset 0, rgba(0,0,0,0.18),
              onClick closes sheet
  3. Panel: position relative, zIndex 50, width 420-500px,
            height 100%, background var(--surface),
            borderLeft 1px solid var(--border),
            display flex, flexDirection column
  4. Header: padding 20px 24px, borderBottom, title + close button
  5. Form body: flex 1, overflowY auto, padding 24px, gap 20px
  6. Footer: padding 16px 24px, borderTop, Cancel + Submit buttons
  Submit button: background var(--accent), color white
  Cancel button: background var(--surface), border var(--border)

### List Page Pattern
Every list view must have:
  1. Page header: title (Playfair Display) + subtitle + action button
  2. Toolbar: search input (400ms debounce) + optional filters
  3. Table container: background var(--surface), border, border-radius
  4. Table: loading skeleton, error state, empty state, data rows
  5. Pagination: prev/next buttons + page count, only if last_page > 1
  6. Delete confirm dialog: fixed overlay + centered dialog box
  7. Sheet component at bottom of render

### Query Key Conventions
  product-categories    : ['product-categories', page, search]
  uoms                  : ['uoms', page, search]
  products              : ['products', page, search, typeFilter]
  product-uoms          : ['product-uoms', page, search]
  product-conversions   : ['product-conversions', page, search]
  product-inventories   : ['product-inventories', page, search, lowStock]
  stock-movements       : ['stock-movements', page, search, typeFilter]
  purchase-orders       : ['purchase-orders', page, search, statusFilter]
  productions           : ['productions', page, search, statusFilter]
  sales-orders          : ['sales-orders', page, search, statusFilter]
  deliveries            : ['deliveries', page, search, statusFilter]
  receipts              : ['receipts', page, search, statusFilter]
  suppliers             : ['suppliers', page, search]
  customers             : ['customers', page, search]
  users                 : ['users', page, search]
  roles                 : ['roles', page, search]
  branches              : ['branches', page, search]
  companies             : ['companies', page, search]

### Dropdown/Select Query Keys (fetch-all for form selects)
  products-all          : ['products-all']
  uoms-all              : ['uoms-all']
  product-uoms-all      : ['product-uoms-all']
  branches-all          : ['branches-all']
  suppliers-all         : ['suppliers-all']
  customers-all         : ['customers-all']
  product-inventories-all: ['product-inventories-all']
  roles-all             : ['roles-all']
  product-categories-all: ['product-categories-all']
