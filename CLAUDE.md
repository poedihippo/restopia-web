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

## Recent implementation (technical)

- **Product inventories:** `ProductInventoryRequest` in `src/types/api.ts` matches API (`product_uom_id`, `code`, `base_price`, `online_price`, optional `price_editable`/`expiry_date`, `status`). `ProductInventorySheet` uses create vs edit Zod schemas, `product-uoms-all` for create, no `branch_id` on form.
- **Product conversions:** API field renamed `conversion_factor` → `amount` in types, `ProductConversionSheet`, and list view (`ProductConversionRequest`, table column “Amount”).
- **Recipes:** `RecipeSheet` and recipe card ingredient lines show `product — UOM (code)` and optional `· SKU: …` for product-UOM options; expanded card materials append UOM name + code after product name.
- **Productions:** `src/views/Productions/` is only `index.tsx` (list: filters, `productions` query with `sort: -created_at`, `filter[search|status|start_date|end_date]`), `ProductionForm.tsx` (nested `details` + `materials`, load-from-recipe), `ProductionDetail.tsx`, `ProductionEdit.tsx` (maps API → form). Pages: `production/index.tsx` and `production/create.tsx` use `next/dynamic` + `ssr: false`; **do not** add `pages/production/create/index.tsx` (duplicate route pulled old `Form/ProductionForm`). Removed legacy `Form/`, `Details/`, `Productions.tsx`, hooks under Productions.
- **List unwrap note:** Some list views use `(data as any)?.data` when the service `queryFn` already returns `r.data` (single `data` array); others use `?.data?.data` per envelope — match the service response when wiring queries.

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->