# Accounting audit — fix list

Started 2026-11-13. Source: read-only audit of `dapur-cokelat-api` (posting
logic, reports) and `dapur-cokelat-web` (accounting screens). ✔ = verified in
code during the audit. Tick items as they land; note anything deferred.

Repos: **API** = `~/Projects/dapur-cokelat-api` (branch `dev`), **WEB** = this repo.
Done means: API `go build/vet/test ./...` clean in `dapur-cokelat-api-local-app-1`,
WEB `tsc` clean, 3001 container rebuilt.

## Batch 1 — Ledger integrity

- [x] 1.1 ✔ Trial Balance always empty: `FindAll(ctx, 0, 0, …)` → `LIMIT 0`
      (`journals/application/usecase/trial_balance_usecase.go:32`).
- [x] 1.2 ✔ Fiscal-year close: closing journals get `""` journal number
      (`fiscal-years/application/usecase/closing_journal.go:43`); close is not one
      transaction (`close_usecase.go:88-96`).
- [x] 1.3 ✔ No "Close fiscal year" button in WEB (`accounting.service.ts` has no FY close).
- [x] 1.4 ✔ Journal number = COUNT+1 → duplicate after any delete
      (`infrastructure/common/helper/code/code.go:67-84`). Use MAX(seq)+1, unscoped.
- [x] 1.5 ✔ Payment DELETE hard-deletes its posted journal, no closed-period check
      (`payments/application/usecase/delete_usecase.go:59`).
- [x] 1.6 Posting sites that ignore closed periods (`FindByDate` has no `is_closed`):
      productions `internal/journal.go:160`, deliveries `internal/cogs.go:316`,
      stock-opname `complete_usecase.go:239`, invoices `create_usecase.go:620`,
      cash-transactions `create_usecase.go:155,202`. One shared open-period helper.
- [x] 1.7 Reversals posted into the original (possibly closed) period:
      receipts `internal/journal.go:484`, deliveries `internal/cogs.go:442`,
      productions `internal/journal.go:264`, invoices `delete_usecase.go:110`.
      Rule: original date if its period is open, else today's open period, else 422.
- [x] 1.8 Manual journal date not checked against `period_id`; `FindPeriodByID`
      not company-scoped (`journals/.../create_usecase.go`, `update_usecase.go`).
      WEB: clear period when date has no match, hide closed periods, hide header
      accounts in line picker. **(web done; API: `periodguard.ValidateJournalPeriod`, line rounding, ≥2 lines, no manual `closing`)**
- [x] 1.9 ✔ Stock opname posts to company `inventory_asset` instead of the
      per-category inventory account (`stock-opnames/.../complete_usecase.go:229`);
      variance likely valued per inventory UOM × per-base-unit cost
      (`internal/inventory_cost.go`). **Done: category → branch chain, fallback by product type, cost × base factor.**
- [x] 1.10 FY / Period forms expose `is_closed` → create-closed skips the close flow.
      WEB: remove checkbox; API: force `is_closed=false` on create. **(web done)**
- [x] 1.11 Periods: no overlap / fiscal-year-bounds check on create.

## Batch 2 — Reports

- [x] 2.1 ✔ Tax report output VAT from invoices only; POS/online `vat_output`
      missing; rate hard-coded 11 (`reports/.../accounting_export_usecase.go:515+`).
      Read both sides from the GL.
      → Done: output VAT read from the `vat_output` GL (POS/online + returns); base still assumes 11%.
- [x] 2.2 Budget vs Actual + Trial Balance include the closing journal
      (`FindAccountBalances`, `journal_repository_impl.go:399`).
- [x] 2.3 Cash flow: cash set misses bank-account / payment-method ledgers;
      transfers count as outflow; opening cash assumed 0; classification via raw
      `statement_type` (`accounting_export_usecase.go:270-307`, repo `:842`).
      → Done: cash set = bank-account ledgers + direct payment-method accounts (company + per-branch) + every branch petty cash; classification via statementClassSQL (asset/liability/P&L → operating, equity → financing; investing/financing per account via cash-flow overrides).
- [x] 2.4 AP aging counts every unpaid PO (draft/rejected/unreceived)
      (`purchase-orders/.../purchase_order_repository_impl.go:616-650`).
      → Done: only partially/fully delivered POs (aging + AP card); inter-branch POs show the supplying branch name.
- [x] 2.5 General Ledger running balance starts at 0 (no opening balance)
      (`reports/.../general_ledger_usecase.go:71`).
      → Done: `opening_balance` per account; running balance starts from it.
- [x] 2.6 Ignored report filters: Journal Entries export (bare `start_date`/`is_posted`),
      Comparative (`year` without `fiscal_year_id`), AR/AP card party filter.
      → Done (API): journals `filter[date_gte|date_lte]`; AR card `customer_id`, AP card `supplier_id`/`supplier`. Web parts in "Web follow-up".
- [ ] 2.7 AR aging: "Current" bucket merged into 0–30 (`reports/.../aging.go:42`);
      return amounts not date-filtered.
      → Partly: new `bucket_current` for not-yet-due. **Deferred:** dating returns for back-dated aging — returns are stored only as totals on the SO, no dated return ledger exists.
- [x] 2.8 Timezone: `time.Now()` UTC for return journals and default `as_of_date`.
      → Done: `helper_time.BusinessDate(branch tz, default Asia/Jakarta)` for partial-return journals, refunds, default report as_of_date.
- [x] 2.9 Budget variance sign for credit-normal accounts.
      → Done: both BvA paths use normal-balance actuals; variance positive = favourable.

## Batch 3 — Screens

- [x] 3.1 ✔ Cash in/out: WEB sends offsetting account + department, API ignores
      them and always books petty cash. **Decision (2026-11-13):** API accepts an
      optional `chart_of_account_id` (and `department_id` if journals support it);
      when absent, keep today's behaviour (petty cash). **(web done: department removed,
      optional `chart_of_account_id` sent)**
- [x] 3.2 Cash Transactions list: wrong includes → blank columns; search and bank
      filter keys not allowed by API.
- [x] 3.3 Invoice create form total ignores discount + tax (`Invoices/InvoiceForm.tsx`).
- [x] 3.4 Invoice detail payments: `filter[invoice_id]` doesn't exist on payments. **(web done: pages all
      results, per_page 200; needs API filter)**
      → Done (API): payments `filter[invoice_id|sales_order_id|purchase_order_id]` via allocations.
- [x] 3.5 Supplier debts / PO payments capped at 1000 / 100 newest POs.
- [x] 3.6 Default dates via `toISOString()` (UTC) in POPayments, SupplierDebtDetail,
      CashTransactions.
- [x] 3.7 Bank account balance double counting; `opening_balance` editable anytime. **(web done:
      opening balance locked when current ≠ opening, shared-CoA warning)**
      → Done (API): `has_transactions` on bank accounts; opening balance change refused once the ledger account has lines.
- [x] 3.8 Small: number parsing drops decimals (POPayments, cash amount); cash reverse
      reason discarded; 0% tax rejected (`required` on float); float equality in
      journal detail balance check. **(web done; 0% tax needs the API fix)**
      → Done (API): tax `rate` is a pointer → 0% allowed, capped at 100.

## Batch 4 — Missing features

- [x] 4.1 ✔ Invoice "unlock overdue" button (`POST /invoices/unlock-overdue`, superadmin).
- [x] 4.2 Invoice void action (`DELETE /invoices/:id`).
- [x] 4.3 On-screen (JSON) views for Cash Flow, Tax, Budget vs Actual.
      → Done (API): GET /reports/cash-flow, /reports/tax-report, /reports/budget-vs-actual (same builders as the exports).
- [ ] 4.4 Drill-down TB / BS / IS → General Ledger → source document.
      → API: GL lines now carry `reference_id`; screens in "Web follow-up".
- [x] 4.5 Trial Balance opening / movement / closing columns.
      → Done (API): `opening_balance` / `closing_balance` per TB row.
- [x] 4.6 Branch filter on General Ledger, tax, aging.
      → Done (API): report branch filter on GL, tax, BvA, TB export. **Aging still active-branch only** (its queries use branch tenancy, not the report scope).
- [ ] 4.7 Retained-earnings roll-forward; AR/AP aging vs control-account tie-out.
- [ ] 4.8 Opening balances for mid-history migration.
- [ ] 4.9 e-Faktur / Coretax export.

## Extra fixes found while working

- [x] Journal numbers for reference types sharing the generic segment (e.g. portionings) collided with manual journals — numbering now reads the max existing number by prefix.
- [x] Manual edit/delete/reverse refused for document-posted journals (reference set, not `opening_balance`); manual reverse of a closed-period journal goes to today's open period.
- [x] Delivery COGS skipped when the sales order's settle journal already booked HPP (double COGS).
- [x] Operations `close_trigger` was always null; shifts search hit a non-existent column (done earlier this session).

## Re-check (2026-11-13, before 13:00 WIB) — independent review fixes

- [x] Year-end closing journal could be reversed/edited/deleted by hand → now refused (API).
- [x] AP card: payments to not-yet-received POs counted with no matching purchase → same received-PO rule on both sides (API).
- [x] Reversal "today" used the UTC date → `BusinessDate` (Asia/Jakarta) (API).
- [x] Cash-transaction delete failed when its journal row was already gone (API).
- [x] Period edit blocked for legacy overlapping rows → range check only when dates / fiscal year change (API).
- [x] `fetchAllPages` read `meta.last_page` (API sends `total_pages`) → multi-page lists stopped at page 1; also affected sales reports (web).
- [x] Voided payments could not be deleted in the UI though the API allows it → separate `paymentDeleteBlock` (web).
- [x] Report default dates built in UTC (start could be the previous month's last day before 07:00 WIB) → local dates in all report pages (web).
- [x] General Ledger journal link opened the unfiltered list → Journals page opens `?id=` (web).

## Notes / deferred

- 4.7 Retained-earnings roll-forward + AR/AP vs control-account tie-out — **deferred**: needs a decision on which accounts are the AR/AP control accounts per branch (ar_trade / ar_trade_customer / ap_trade overrides) before a tie-out means anything.
- 4.8 Mid-history opening balances — **deferred**: the Opening Balances screen (journal-based) already covers posting them; a migration importer needs the source data format.
- 4.9 e-Faktur / Coretax export — **deferred**: the system stores no NSFP (tax-invoice serial) or customer NPWP, so a compliant file can't be produced yet.
- Delivery COGS still skips lines whose product has no base-unit conversion: those products also have no average cost, so the line would be 0 anyway; making it an error would block deliveries.
- Bank/COA balances (`FindAccountBalancesByIDs`) stay company-wide for branch users — bank accounts are company-level.

- Never run migrations or backfills against DEV/PROD (`.env*` point at real DBs).

## Web follow-up (reports)

- [x] Cash Flow, Tax Report, Budget vs Actual: on-screen tables (`v2-card` + `v2-table`, skeleton, empty state, totals rows) from `GET /reports/cash-flow|tax-report|budget-vs-actual`, Excel export kept, branch selector (`FinanceBranchSelect`, sent as `branch_id`) on all three. BvA variance coloured: positive = favourable = `--success`, negative = `--destructive`.
- [x] General Ledger: "Opening balance" row at the top of each account (also in the Excel export), line reference is a `ReferenceLink` (`reference_type` + `reference_id`), journal number links to the journals list, branch selector added. Reads `account_id` / `coa_code` / `coa_name` / `start_date` / `end_date` / `branch_id` from the URL for drill-downs (`src/views/Reports/GeneralLedger/glHref.ts`).
- [x] Trial Balance: Opening and Closing columns (signed, shown as `Rp x Dr|Cr`) with totals; balanced check compares in cents; fixed the missing "No." cell; each row drills down to the GL for that account and the period's dates. Uses `journalsService.trialBalance`.
- [x] Balance Sheet (1 Jan of the as-of year → as-of) and Income Statement (its date range): account rows drill down to the GL by account code.
- [x] AR / AP aging: "Current (belum jatuh tempo)" bucket card (`bucket_current`) and `current` line label; AP note says only received POs are listed.
- [x] AR / AP card exports: start and end date required (button disabled with reason); AP card sends `supplier_id` (supplier name as fallback).
- [x] Journal Entries export sends `filter[date_gte]`, `filter[date_lte]`, `filter[is_posted]`.
- [x] Comparative reports: fiscal year required (the `year` input was removed — the API ignores it); export disabled with a tooltip until chosen.
- [x] Journal guards (`src/lib/actionGuards.ts`): edit / delete / reverse disabled for document-posted journals ("Posted by <document> — change it from that document"); reverse no longer blocked by a closed period.

## Bank reconciliation + Accounting dashboard (Nov 2026)

API (`dapur-cokelat-api`, branch `dev`):
- [x] Migration `000168_create_bank_reconciliations` (tables `bank_reconciliations`, `bank_statement_lines`, `bank_reconciliation_matches`; FK `journal_details` RESTRICT, one match per journal line). Checked on a scratch DB only — **not applied to DEV/PROD**.
- [x] Module `internal/modules/bank-reconciliations`: list/create/find/update balances/delete (draft), `PUT /:id/statement-lines`, `GET /:id/ledger-lines`, auto-match (same amount + direction, ±3 days, unique candidates only), manual match (totals must balance), unmatch, book a bank-only line as a cash transaction, complete/reopen, Excel export.
- [x] Rules: one reconciliation per bank account per period; reconcile periods in order (no new one while an earlier is draft, none for an earlier period); only the latest can be reopened, and only while its period is open; outstanding ledger lines start at the account's first reconciliation; a completed reconciliation keeps its figures when later ones match its outstanding lines.
- [x] Journal guards: `Update`, `ForceDelete`, `ForceDeleteByReference` refuse journals with a reconciled line (422 "unmatch it there first") — covers payment, cash-transaction and every document delete.
- [x] Period close refuses while a reconciliation of the period is still draft.
- [x] `CashTransactionUsecase.CreateWithinTransaction` (Create delegates to it).
- [x] `GET /v1/dashboard/accounting-tasks` (15 task keys + KPIs), permission `accounting-dashboard.read` or `journal.read`.
- [x] Permissions `bank-reconciliation.*` (read/create/update/delete/complete) and `accounting-dashboard.read` in `permission_definition.go` — roles still need to be granted them.
- [x] Tests: auto-match uniqueness, match balancing, complete conditions, period-close refusal, dashboard task computations. OpenAPI regenerated.

Web (`zulfi`):
- [x] Accounting › Bank Reconciliation (list, new sheet, workspace with upload/preview, two-pane matching, book sheet, summary), "Reconcile" on Bank Accounts, shared `src/utils/excelImport.ts`.
- [x] Accounting Dashboard as the first ACCOUNTING menu.

Open:
- [ ] Run migration 000168 on DEV, grant the new permissions to the accounting roles, then reconcile one real BCA/Mandiri month end-to-end.
- [ ] The list's Difference column shows "—" (the list has no summary); add it to the list response if wanted.

## Re-audit 2026-11-16 — new findings

Independent read-only pass over API (`dev` @ e058f805) and WEB (`zulfi`). API build/vet/test clean (DB tests skipped); WEB tsc clean in accounting code.

### Deferred — changes the business flow (decide before fixing)

- [ ] **Production without materials** adds stock with no journal (`productions/.../internal/journal.go:190` skips a 0 total) and leaves avg cost untouched (`product-costs/domain/service/inflow.go:46`). On sale, COGS credits an inventory account that was never debited; a product with no cost sells at 0 COGS. Options: require a unit cost and post Dr Finished Goods / Cr production-cost-absorbed (or inventory adjustment); treat as stock adjustment; or block material-less productions. Need the business reason productions run without materials.
- [ ] **Unbalanced auto-journals are silently skipped** — receipts `internal/journal.go:316`, deliveries `cogs.go:354`, productions `internal/journal.go:190` return `nil, nil` and the document still finalizes. Making it an error would block documents; decide error vs. auto rounding line.
- [ ] **Intra-company inter-branch sales**: `ShouldPostCogs` false for same-company `po_from_branch`/`transfer_to_branch` (`deliveries/.../internal/cogs.go:42`), but seller can invoice (revenue + AR) and buyer receipt books Dr inventory / Cr AP → revenue without COGS, stock counted twice, no due-to/due-from or elimination.
- [ ] **Same-company transfers post no GL** — per-branch inventory accounts drift from stock.
- [ ] **Payment / cash-transaction delete hard-deletes the posted journal** in an open period (`payments/.../delete_usecase.go:71`, `cash-transactions/.../delete_usecase.go:51`) instead of reversing.
- [ ] **Stock opname books 0 variance** when a product has no avg cost (`stock-opnames/.../inventory_cost.go:27`).
- [ ] No central debit = credit check in `JournalRepositoryImpl.Create/Update`, no DB constraint (each posting site checks itself).
- [ ] Production cost = materials only (no labour/overhead absorption, no WIP). Acceptable for same-day bakery runs; matters for per-product margin.
- [ ] Suspected, not traced: POS order with a delivery is skipped by the sales journal (`sales_journal.go:276`) — no revenue unless an invoice is raised.
- [ ] Tax report base still assumes 11%; AR/AP vs control-account tie-out (4.7) still open.

### Fixed 2026-11-16 (no business-flow change)

API (`dapur-cokelat-api`, `dev`, uncommitted; build/vet/test clean, 81 packages):
- [x] COA update refuses changing `account_type_id` / `normal_balance` or setting `is_header=true` once the account has journal lines (`PostedAccountLockedFields`). Not done: refusing header for accounts referenced in account settings (5 settings tables).
- [x] Manual journals: `reference_type` only empty or `opening_balance`, `reference_id` empty.
- [x] Payment journals: amounts/fees rounded to cents at the request boundary + `journal_entity.RoundAndBalanceDetails` (rounding drift onto the largest line, real mismatch → error). Cash-transaction amounts rounded to cents.
- [x] Manual and cash reversals book to the original's branch.
- [x] `BusinessDate` for SO reversal, supplies-used, payment void.
- [x] Supplier statement: optional `supplier_id`; name match is exact (trimmed, case-insensitive) — "Toko A" no longer matches "Toko AB".

WEB (`zulfi`):
- [x] Sales by Invoice + Invoice detail payments read `meta.total_pages` (pager was hidden / payments stopped at 200).
- [x] Opening balance re-save: new draft first, then reverse the old one; draft deleted if the reversal fails.
- [x] "Closing" removed from manual journal types; closing journal's edit/delete/reverse disabled.
- [x] Balance Sheet / Income Statement / AP Aging check `report.read` (API guard); Trial Balance export disabled without `report.read`.
- [x] Allocate Payment: document picker by number (shows party + outstanding) instead of a raw id.
- [x] Period Reopen disabled when its fiscal year is closed.
- [x] Journals Export sends the list's filters.
- [x] Balance Sheet "Current Year Earnings" row no longer drills into the GL.
- [x] Supplier export filenames use the local date.
- [x] Supplier Statements: supplier dropdown built from the statement's parties (exact-name match, includes supplying branches).

Still open (low): cash-transaction delete guard reads `journal.period` which the API doesn't return (API still blocks closed periods).

## Employee credit settlement (2026-11-18)

Client flow: employee credit order → Piutang Dagang Customer XX; Credit tender (users.credit deduction) → Piutang Dagang Counter XX; accounting clears it on the Settlement screen into an account it picks (payroll).

- [x] API: Credit-tender payments on staff-credit orders are marked `settlement_status=pending` after their journal posts (`isEmployeeCreditTender`).
- [x] API: settlement of the Credit method takes `chart_of_account_id` instead of `bank_account_id`, no fees; journal D target / K the account each payment's journal debited (`settlement_employee_credit.go`). OpenAPI regenerated.
- [x] Migration `000171_payment_settlement_target_account` (chart_of_account_id, bank_account_id nullable, exactly one of the two). **Not applied** — until it is, creating ANY settlement on that DB fails (insert names the new column).
- [x] WEB: Settlement screen has a "Kredit Karyawan" method card; its form asks for the target account and hides fees; history shows the account.
- [x] Apply 000171 on dcdev (done by user 2026-11-18).
- [x] Map Payment Methods › Credit › branch accounts: CB 113100100, BT 112100100, DP 114100100, MR 115100100 (Piutang Dagang Counter); pickup points inherit. (set on dev 2026-11-18)
- [ ] Credit tenders taken before this change have no pending status, so they don't appear for settlement.
- [x] End-to-end on dev (2026-11-18, TEST data): SO 0009/CB/11/2026 (Rp 5.500, credit user 14) → payment PAY-20261118-00001 journal D Counter CB / K Customer CB, pending → settlement 0001/CB/11/2026 D Gaji Outlet 663100110 / K Counter CB; payment settled, Counter net 0.

## Online channels → Piutang Dagang Customer (2026-11-18)

- [x] `docs/sql/2026-11-18_online_channels_to_piutang_customer.sql` run on dcdev by the user. Verified: 16 old accounts inactive with 0 lines; 12 online channel receivables on Piutang Dagang Customer XX; 0 live `sales_revenue_online` overrides; 0 unbalanced company-2 journals. Customer DP 3.272.000 = old GoFood 2.706.000 + Grab 285.000 + Shopee 281.000; Customer BT 251.000 = old GoFood BT.
- [ ] Deploy the API (ResolveSalesRevenueCOA fallback) before anyone uses the deployed dev API for online sales.

## Customer credit → Piutang Counter + full recheck (2026-11-18)

- [x] API: a deposit-later payment (requires_settlement) on a credit sale posts D Piutang Dagang Counter / K Piutang Dagang Customer at once (`counter_reclass.go`); its settlement clears Counter (`settledLegsAfterReclass`). Counter-sale payments unchanged (no journal until settlement).
- [x] API: sales-order filter `funds_status=cleared`.
- [x] Dev e2e (TEST data): SO 0010/CB/11/2026 customer credit → BCA PAY-20261118-00002 (D Counter CB / K Customer CB, pending) → settlement 0002/CB/11/2026 (D Bank BCA / K Counter CB); Customer CB and Counter CB net 0.
- [x] Dev e2e (TEST data): online SO 0011/CB/11/2026 GoFood → D Piutang Dagang Customer CB / K Pendapatan Counter CB; payout D Bank 5.000 + D Jasa Go Resto 500 / K Piutang Dagang Customer CB.
- [ ] Run `docs/sql/2026-11-18_fix_credit_tender_company1_account.sql`: 13 legacy Credit-tender journals (27 Oct) still debit company 1's 13-51-000 Piutang Karyawan (12 customer → Piutang Customer, net zero; 1 employee → Piutang Counter BT + payment pending).
- [ ] Payment Methods: set CASH (and DP / CARD if collected at the outlet) to "settle later" so outlet cash goes through Piutang Counter → settlement.
- [ ] Commit + deploy API and web; dedicated settlement permission (deferred).
- [x] `docs/sql/2026-11-18_sales_revenue_online_per_branch.sql` run by the user: all 18 company-2 branches have `sales_revenue_online` = their own Pendapatan Counter (PP rows included), no duplicates, no other company touched.

## POS Kredit Customer (2026-11-18)

- [x] API checkout: an offline sale with `credit_type=customer` may have no tender (stays credit/unpaid; DP optional).
- [x] POS: payment modal has a separate "Bayar Nanti (Kredit)" section (Kredit Karyawan / Kredit Customer); Credit is no longer in the money-tender grid. Kredit Customer needs a registered customer, or name + phone (registered on the fly — `POST /customers` returns no id, so the POS looks it up by name + phone). Without DP: no tender; with DP: the DP method is picked from the grid.
- [x] POS: staff credit balance check (Full / DP / split), and all payment choices reset after an order or an empty cart.
- [x] Dev e2e (TEST data): order 0015/CB/11/2026 for customer "TEST RS Hospital (Claude)" (customer id 79): credit, pending, no payment; journal D Piutang Dagang Customer CB / K Pendapatan Counter CB.
