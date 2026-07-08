# Dapur Cokelat — Agent Handover: How to Prompt Claude Code

This document tells the next assistant how to drive **Claude Code (Opus)** for the
Dapur Cokelat bakery-management platform. Poedi runs the prompts locally against two
repos and reports results back. Your job is to **diagnose, then write one atomic prompt
at a time** — never guess, never batch unrelated changes.

---

## 1. Repos, stack, deploy

**Two separate repos**, tag every prompt `[FRONTEND]` or `[BACKEND]`:

- **Frontend** — Next.js (Pages Router), TypeScript, TanStack Query v5, react-hook-form + Zod,
  axios, sonner. **Inline CSS variables only — no Tailwind, no shadcn.** Deploys on Vercel.
  Repo: `github.com/poedi1612/dapur-cokelat-web`.
- **Backend** — Go / Gin / GORM / PostgreSQL, layered DDD. Lives at `https://dc.albatech.id/v1`.

**API contract (source of truth):** `https://dc.albatech.id/v1/docs/api/openapi.yaml`
Fetch this fresh when you need to confirm an endpoint, filter, include key, or enum —
it can be stale vs. the running server, so when in doubt, verify with a live `curl`.

**Deploy verification:** Claude Code sometimes commits locally without pushing.
Always end backend/frontend prompts with `git log origin/main -1 --oneline` to confirm
the commit is on `origin/main`. Vercel auto-deploys `main`; the Go backend deploy
mechanism is operator-controlled — if a backend fix "didn't take," first check the
server actually redeployed before re-debugging.

---

## 2. The workflow (do not skip steps)

1. **Diagnose read-only first.** Never write a fix prompt from a guess. Use a read-only
   audit prompt (dump the relevant code + line numbers) and/or a live `curl` against
   `dc.albatech.id`. Confirm the root cause with evidence before touching anything.
2. **Write ONE atomic prompt** in the exact format in §3, tagged `[FRONTEND]`/`[BACKEND]`.
3. Poedi runs it in Claude Code and reports back (diff + build result + `git log`).
4. **Verify** (browser screenshot or curl), then write the next prompt.

**"Saved data doesn't show" ≠ display bug.** Before assuming hydration/include problems,
`curl` the record and check the data actually **persisted**. A whole session was lost
chasing edit-form hydration when the real bug was the data never saved.
`curl … | python3 -c "…; print('field present:', x is not None)"` is the fastest check.

---

## 3. The atomic prompt format (use verbatim)

```
GOAL:
(one sentence — a single task)

FILES:
(explicit file paths — never "search" or "find")

CHANGES:
(step-by-step, mechanical, numbered)

CONSTRAINTS:
(what NOT to touch; environment rules)

OUTPUT:
(diff / files / build result / git log line)
```

Rules for the prompt body:

- **One goal only.** If it's complex, split into multiple prompts (e.g. audit → model →
  service → handler → verify). Do not combine.
- **Explicit paths.** You often can't see the FE repo; give the best-known path and note
  it's an assumption if unsure — Claude Code corrects one path, it can't unpick a wrong batch.
- **No explanations, no optional steps** inside the prompt. Save reasoning for Poedi, outside the prompt.
- Do **not** prefix prompts with model recommendations — everything runs on Claude Code Opus.
- Commit + push in the **same** prompt (Poedi's preference), message convention
  `type(scope): summary` e.g. `fix(productions): …`.
- Always require: build passes (`go build ./...` for backend, `tsc --noEmit` + `next build`
  for frontend) **before** commit, and end with `git log origin/main -1 --oneline`.

### Read-only audit prompt shape

```
GOAL:
Output (read-only, no edits) <exactly what to dump> to diagnose <the symptom>.

FILES:
(explicit paths)

CHANGES:
1. Print <method/struct/JSX> verbatim with line numbers.
2. State plainly: (a) … (b) … (c) …

CONSTRAINTS:
- DO NOT edit any file. Read-only.
- DO NOT commit, push, build, or deploy.

OUTPUT:
- The code excerpts with line numbers.
- One-line conclusion naming the root cause + file:line.
```

---

## 4. Critical infrastructure facts (do not violate)

- **Database is PostgreSQL on port 5432.** `psql -h localhost -p 5432 -U dapur_cokelat_admin -d dapur_cokelat`.
  There is a **stale MySQL** `dapur_cokelat` on **port 3306** that must NEVER be queried.
- **`axios baseURL` in `src/hooks/useApi.ts` is absolute** (`https://dc.albatech.id/v1`).
  Never make it relative. Go 307-redirects trailing-slash routes with relative `Location`
  headers → infinite redirect loops through the Vercel proxy, and trailing-slash 307s
  silently drop POST bodies cross-origin (once caused receipts to save with empty details).
- **`NEXT_PUBLIC_API_URL`** must be set in Vercel (Production+Preview+Development) to
  `https://dc.albatech.id/v1` (no trailing slash). `next.config.ts` throws at build time if unset.
- **Backend dates** are returned as `"DD-MM-YYYY HH:mm WIB"` — `new Date()` cannot parse this →
  "Invalid Date" everywhere. Use the shared helper `formatBackendDate` in `src/utils/date.ts`
  for display. For `<input type="date">` you need `YYYY-MM-DD` instead (separate conversion —
  do NOT use `formatBackendDate` for input values).

---

## 5. Recurring bug classes (check these first)

1. **Nested-mapper omission / unregistered deep includes.** A field is present on the
   standalone endpoint but nil/absent when nested under an include, because either the
   include key isn't registered in `*AllowedIncludes` or the mapper doesn't assign the
   relation. Seen in: products `product_uoms`, stock-movements, `/auth/me` `branch`,
   productions `production_details`. **First hypothesis when a field is missing in nested
   context.** Fix = register the include key AND ensure the response mapper assigns it.
2. **Nil-relation deref in response mapper → 500.** A mapper dereferences a pointer
   relation that wasn't preloaded (e.g. `e.Branch.Timezone` before the `if e.Branch != nil`
   guard) → panic → generic `{"message":"internal server error"}`. Fix = guard the deref;
   don't just add a preload (mapper must be nil-safe regardless of includes).
3. **Response envelope depth mismatch.** `/products` and some list endpoints are
   double-nested: array at `r.data.data.data` (use `unwrapProductsList`). Other list
   endpoints are single-nested: `r.data.data` (use `unwrapList`). Reading one level too
   shallow yields the pagination wrapper (not an array) → `.map`/`.length` throws or renders
   empty. `queryFn` always ends `.then(r => r.data)`.
4. **`buildPayload` guard silently drops fields.** A `.filter(x => x.some_id > 0)` drops
   rows whose id is 0/unset. If a value is written only via `setValue` (no registered input),
   a row can *look* populated while its id is 0 → dropped at submit → saved empty. Fix =
   register the field (hidden `<input>`), don't rely on `setValue` alone. (This is why
   production materials saved empty.)
5. **`filter[…]` param assumptions.** `/recipes` supports only `filter[product_id]` and
   `filter[is_default]` — NOT `filter[product_uom_id]`. Confirm available filters in
   `openapi.yaml` before relying on them. A hard-coded `filter[is_default]=1` will return
   nothing if the record isn't flagged default.
6. **`qty` vs `stock` field-name drift.** Inventory rows return availability in `stock`,
   not `qty`. Frontend reading `.qty` (undefined) with `?? 0` makes everything read as 0.
   Confirm the actual response field before filtering/displaying.

---

## 6. curl recipe (auth + verify)

```bash
TOKEN=$(curl -s -X POST "https://dc.albatech.id/v1/auth/token/" \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@gmail.com","password":"!AMR00T"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")

# use -g to disable glob so filter[...] brackets work:
curl -g -s "https://dc.albatech.id/v1/<endpoint>?include=<...>&filter[x]=1" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

- `-g` (glob-off) is required whenever the URL has `filter[...]` brackets, or curl returns empty.
- Superadmin currently has an active branch via `PATCH /auth/change-active-branch` +
  the `/auth/me` `branch` preload fix. Branch-scoped queries need an active branch or they
  return empty / disable client-side.

---

## 7. Conventions

- **File naming:** `[Name]Sheet.tsx` (side-panel forms) / `[Name]Form.tsx` (full-page forms).
- **Indonesian number formatting:** `toLocaleString('id-ID')`.
- **Superadmin creation is not permitted through the UI** — user-type field hidden on user create.
- **Never edit legacy/MIXED-folder duplicate forms** (e.g. `*/Modal/*`, `SalesOrdersFormPOS`,
  `PurchaseOrders/Form/*`) without first confirming they're routed/live. Many are dead;
  editing them wastes cycles and edits nothing the user sees. When unsure, have Claude Code
  confirm the file is referenced by a route before touching it.
- **Backend has a separate programmer** who may push back. Frame backend changes with
  justification the programmer can evaluate; confirm intended behavior before assuming a bug
  (e.g. per-line production finalize is intentional — the *detail* status must be Final for
  stock to post, not just the header).

---

## 8. Module state at handover

**Working / verified:** Deliveries, Receipts, Vouchers, Users, Roles, Branches, Companies,
Bundles, Payments, Payment Methods, Dashboard, Sales Orders, Production (create/edit/stock-posting),
Product Inventory, Stock Movements, POS (WebUSB printing), Surat Jalan, Recipes (shared
`ProductUomPicker`), branch switching, `/auth/me` active-branch hydration.

**In flight / recently touched:**
- **Auto-generated document codes** — backend already generates codes for all 5 modules
  (`GenerateCode` per module: `PO. / DEL. / REC. / PROD. / INV.` prefixes, timestamp+rand).
  Frontend work: hide the editable code field on create, show read-only on edit. Production
  done; PO / Internal Order / Receipt / Delivery / Transfer Out / Transfer In / Sales Order
  being batched. **Latent risk:** generators use timestamp+`rand(1000)` with NO DB unique
  index on `code` on any of the 5 tables → silent collision possible. Fix later = per-module
  sequence/counter + `uniqueIndex` on `code`.
- **Date sweep** — `formatBackendDate` created in `src/utils/date.ts`, adopted in
  StockMovement, ProductInventories, Productions list. A repo-wide sweep of remaining
  `new Date(<api field>).toLocaleX` display calls was in progress — verify coverage.
- **Production materials persistence** — fixed by registering `product_inventory_id` as a
  hidden RHF field (commit `a859628`). **Verify:** a fresh Final production of Choco Ball
  (recipe = 2 telur omega) must post `Choco Ball +1` AND `telur omega −2` in Stock Movements.
  (Production #1 is a corrupted test record saved with zero materials — ignore/delete it.)

**Paused feature — Invoice module (internal-branch billing):**
- Design locked: invoice = frozen obligation created from an internal-branch **delivery**
  (delivery with `purchase_order_id` set, PO `type=branch`). Billed branch = `PO.branch_id`.
  Lines snapshot from delivery details, total computed server-side from delivered lines.
  Invoice `status` = `issued/void`; `payment_status` = `pending/partial/paid` **derived**
  from linked payments (mirror `SalesOrder.SyncPaymentStatus`). Add nullable `invoice_id`
  to `payments`.
- Progress: models + `InvoiceStatus` enum + migration committed (`6092983`), `go build`
  verified green. **Next = prompt 2 of 6:** domain layer (entities, repository interface+impl,
  mappers) modeled on the **receipts** module minus all stock-movement machinery.
- Receipts module is the structural template (created from a `delivery_id`, details + total
  + status, single transactional write, audit log). New-module registration points:
  `connection.go` `AutoMigrate(...)` slice; `v1_modules.go` `RegisterRoutes`;
  per-module `container` DI; `permission_definition.go` for `invoice.*`.
  Import-cycle caveat: use `product_uom_simple_response` for nested types to avoid the
  `product_uom_response ↔ product_response` cycle.

---

## 9. First actions for the next agent

1. Confirm the **auto-code batch** landed on all 7 forms (create hides code, edit read-only,
   create payload omits empty `code`); spot-check each create form in the browser.
2. Verify the **date sweep** result (grep should show no remaining `new Date(<api field>).toLocaleX`
   in `src/views`).
3. Run the **−2 production** correctness check (fresh Final production posts the right raw-material OUT).
4. Then resume the **Invoice module** at prompt 2 (domain layer), or address the **code
   collision/unique-index** hardening if data integrity is prioritized.
