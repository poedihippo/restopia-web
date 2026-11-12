"use client";
import { fetchExpenseAccounts } from "@/utils/expenseAccounts";
import { formatDateShort, formatDateTime } from "@/utils/date";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, X } from "lucide-react";
import { ActiveSegment, FilterBar, FilterSelect, countActive } from "@/components/ListFilters";
import { paymentMethodsService as paymentMethodService } from "@/services/payment-methods.service";
import { chartOfAccountsService } from "@/services/accounting.service";
import { companiesService } from "@/services/companies.service";
import { bankAccountsService } from "@/services/bank-accounts.service";
import SearchableSelect from "@/components/SearchableSelect";
import { useAuth } from "@/hooks/useAuth";
import PaymentMethodBranchAccounts from "./PaymentMethodBranchAccounts";

export default function PaymentMethodsView() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canRead = hasPermission("payment-method.read");
  const canCreate = hasPermission("payment-method.create");
  const canEdit = hasPermission("payment-method.update");
  const canDelete = hasPermission("payment-method.delete");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("all");
  const [chartOfAccountId, setChartOfAccountId] = useState<number | null>(null);
  // Customer payments with this method stay in Piutang until they are settled
  // (Payments → Settle Payments); the fee account takes received < total.
  const [requiresSettlement, setRequiresSettlement] = useState(false);
  const [feeAccountId, setFeeAccountId] = useState<number | null>(null);
  // Inactive methods keep their history but are hidden from payment pickers.
  const [isActive, setIsActive] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<{
    id: number;
    name: string;
    type?: string;
    chart_of_account_id?: number | null;
    bank_account_id?: number | null;
    bank_account?: {
      id: number;
      bank_name: string;
      account_number: string;
      account_name: string;
    } | null;
    chart_of_account?: {
      id: number;
      company_id: number;
      account_type_id: number;
      code: string;
      name: string;
      normal_balance: string;
      is_header: boolean;
      is_active: boolean;
    };
    created_at?: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [originFilter, setOriginFilter] = useState<"all" | "manual" | "coa">(
    "all",
  );
  const [typeFilter, setTypeFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("true");

  const { data: companiesData } = useQuery({
    queryKey: ["companies-all"],
    enabled: canRead,
    queryFn: () =>
      companiesService.list({ per_page: 100 }).then((r) => r.data),
  });
  const companyOptions: { id: number; name: string }[] =
    (companiesData as any)?.data ?? [];

  const { data: chartOfAccountsData, isLoading: chartOfAccountsLoading } =
    useQuery({
      queryKey: ["chart-of-accounts-pm"],
      queryFn: () =>
        chartOfAccountsService
          .list({
            per_page: 500,
            sort: "code",
            "filter[use_as_payment_method]": "true",
          } as any)
          .then((r) => (r.data as any)?.data ?? []),
      enabled: showForm,
    });
  const chartOfAccounts = chartOfAccountsData ?? [];
  // Default fee account for settlements: an active, non-header expense
  // account, e.g. Biaya Admin Bank / MDR.
  const { data: feeAccountsData, isLoading: feeAccountsLoading } = useQuery({
    queryKey: ["chart-of-accounts-fee", "expense"],
    queryFn: fetchExpenseAccounts,
    enabled: showForm && requiresSettlement,
  });
  const feeAccountOptions = [
    { value: 0, label: "— None —" },
    ...((feeAccountsData ?? []) as any[]).map((coa: any) => ({
      value: coa.id as number,
      label: (coa.name as string) ?? `COA #${coa.id}`,
      sublabel: (coa.code as string) ?? undefined,
    })),
  ];

  // Bank accounts only label the Kas/Bank picker ("BCA · 123…"), so users
  // recognise the account without reading COA codes.
  const { data: bankAccountsData } = useQuery({
    queryKey: ["bank-accounts-all", "pm-labels"],
    queryFn: () =>
      bankAccountsService
        .list({ per_page: 1000 } as any)
        .then((r) => (r.data as any)?.data ?? []),
    enabled: showForm,
  });
  const bankByCoaId = new Map<number, any>(
    ((bankAccountsData ?? []) as any[])
      .filter((b) => b.chart_of_account_id)
      .map((b) => [Number(b.chart_of_account_id), b]),
  );

  // Searchable options for the Kas/Bank picker (searchable by name and code).
  const coaSelectOptions = [
    { value: 0, label: "— Choose account —" },
    ...chartOfAccounts.map((coa: any) => {
      const bank = bankByCoaId.get(Number(coa.id));
      return {
        value: coa.id as number,
        label: (coa.name as string) ?? `COA #${coa.id}`,
        sublabel: bank
          ? [bank.bank_name, bank.account_number, coa.code]
              .filter(Boolean)
              .join(" · ")
          : ((coa.code as string) ?? undefined),
      };
    }),
  ];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading: listFirstLoad, isFetching: listFetching } = useQuery({
    queryKey: [
      "payment-methods",
      debouncedSearch,
      typeFilter,
      companyFilter,
      statusFilter,
    ],
    queryFn: () =>
      paymentMethodService
        .list({
          per_page: 1000,
          sort: "id",
          include: "chart_of_account",
          "filter[search]": debouncedSearch || undefined,
          "filter[type]": typeFilter || undefined,
          "filter[company_id]": companyFilter || undefined,
          "filter[is_active]": statusFilter || undefined,
        } as any)
        .then((r) => r.data),
  });
  // Any refetch (after a create/update/delete invalidates the list, or a
  // filter/page change) shows the loading skeleton, never stale rows.
  const isLoading = listFirstLoad || listFetching
  const allItems = (data as any)?.data ?? [];
  const items = allItems.filter((item: any) => {
    // Mirror methods once auto-created per bank account are legacy: payments
    // now pick the bank account itself, so they're never listed.
    if (item.bank_account_id) return false;
    if (originFilter === "manual") return !item.chart_of_account_id;
    if (originFilter === "coa") return !!item.chart_of_account_id;
    return true;
  });

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => {
      // A direct method posts to its Kas/Bank account at once, so it needs one.
      if (!requiresSettlement && !chartOfAccountId && !editing?.bank_account_id)
        return Promise.reject({
          response: {
            data: { message: "Choose the Kas / Bank account the money goes to" },
          },
        });
      const payload: any = {
        name,
        type,
        requires_settlement: requiresSettlement,
        settlement_fee_chart_of_account_id: requiresSettlement
          ? feeAccountId
          : null,
      };
      // A bank-linked method follows its bank account's active flag.
      if (!editing?.bank_account_id) payload.is_active = isActive;
      if (chartOfAccountId !== null)
        payload.chart_of_account_id = chartOfAccountId;
      return editing
        ? paymentMethodService.update(editing.id, payload)
        : paymentMethodService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
      qc.invalidateQueries({ queryKey: ["payment-methods-all"] });
      toast.success(editing ? "Updated" : "Created");
      setShowForm(false);
      setEditing(null);
      setName("");
      setType("all");
      setChartOfAccountId(null);
      setRequiresSettlement(false);
      setFeeAccountId(null);
      setIsActive(true);
    },
    onError: (err: any) => {
      const errData = err?.response?.data;
      if (errData?.errors) {
        Object.values(errData.errors)
          .flat()
          .forEach((m: any) => toast.error(String(m)));
      } else {
        toast.error(errData?.message ?? "Error");
      }
    },
  });

  const { mutate: doDelete, isPending: deleting } = useMutation({
    mutationFn: (id: number) => paymentMethodService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
      qc.invalidateQueries({ queryKey: ["payment-methods-all"] });
      toast.success("Deleted");
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message ?? "Error"),
  });

  const thStyle: React.CSSProperties = {
    padding: "14px 20px",
    textAlign: "left",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--foreground-muted)",
    borderBottom: "1px solid var(--border)",
  };
  const tdStyle: React.CSSProperties = {
    padding: "16px 20px",
    fontSize: 14,
    color: "var(--foreground)",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
  };

  return (
    <div style={{ padding: "32px 40px", fontFamily: "var(--font-sans)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 700,
              color: "var(--foreground)",
              margin: 0,
            }}
          >
            Payment Methods
          </h1>
          <p
            style={{
              color: "var(--foreground-muted)",
              fontSize: 14,
              marginTop: 4,
            }}
          >
            Manage accepted payment methods for POS checkout
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setName("");
              setType("all");
              setChartOfAccountId(null);
              setRequiresSettlement(false);
              setFeeAccountId(null);
              setIsActive(true);
              setShowForm(true);
            }}
            style={{
              height: 40,
              padding: "0 20px",
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            + Add Method
          </button>
        )}
      </div>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search payment methods..."
        activeCount={countActive(typeFilter, companyFilter, statusFilter !== "true")}
        onClear={() => {
          setTypeFilter("");
          setCompanyFilter("");
          setStatusFilter("true");
        }}
        quick={
          <>
            <ActiveSegment value={statusFilter} onChange={setStatusFilter} label="Payment method status" />
            <div style={{ display: "flex", gap: 6 }}>
              {(
                [
                  { key: "all", label: "All" },
                  { key: "manual", label: "Manual" },
                  { key: "coa", label: "COA-linked" },
                ] as const
              ).map((tab) => {
                const active = originFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setOriginFilter(tab.key)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      background: active ? "var(--accent)" : "var(--surface)",
                      color: active ? "white" : "var(--foreground-muted)",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <FilterSelect
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="all">All (SO &amp; PO)</option>
              <option value="sales_orders">Sales Orders</option>
              <option value="purchase_orders">Purchase Orders</option>
            </FilterSelect>
            <FilterSelect
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            >
              <option value="">All Companies</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
          </>
        }
      />
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflowX: "auto",
        }}
      >
        <table
          style={{
            width: "100%",
            minWidth: 1040,
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 50, textAlign: "center" }}>No.</th>
              <th style={{ ...thStyle, width: "14%" }}>Name</th>
              <th style={{ ...thStyle, width: "12%" }}>Type</th>
              <th style={{ ...thStyle, width: "9%" }}>Source</th>
              <th style={{ ...thStyle, width: "24%" }}>Chart of Account</th>
              <th style={{ ...thStyle, width: 100 }}>Status</th>
              <th style={{ ...thStyle, width: "11%" }}>Created</th>
              <th style={{ ...thStyle, width: 200 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                    <td key={j} style={tdStyle}>
                      <div
                        style={{
                          height: 16,
                          background: "var(--border)",
                          borderRadius: 4,
                          opacity: 0.5,
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading && items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    ...tdStyle,
                    textAlign: "center",
                    padding: 40,
                    color: "var(--foreground-muted)",
                  }}
                >
                  No payment methods yet. Add Cash, Transfer, or QRIS to get
                  started.
                </td>
              </tr>
            )}
            {items.map((item: any, idx: number) => {
              return (
                <tr key={item.id}>
                  <td style={{ ...tdStyle, textAlign: "center", color: "var(--foreground-muted)", fontSize: 13, width: 50 }}>
                    {idx + 1}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {canRead ? item.name : "***"}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {canRead ? item.type || "—" : "***"}
                    {canRead && item.requires_settlement && (
                      <div
                        title="Customer payments stay in Piutang until settled"
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: "var(--warning)",
                        }}
                      >
                        Needs settlement
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdStyle, verticalAlign: "top" }}>
                    {canRead ? (
                      item.chart_of_account_id ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "var(--accent-light-bg)",
                            color: "var(--accent)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          COA
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            background: "var(--background)",
                            border: "1px solid var(--border)",
                            color: "var(--foreground-muted)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Manual
                        </span>
                      )
                    ) : (
                      "***"
                    )}
                  </td>
                  <td style={{ ...tdStyle, verticalAlign: "top" }}>
                    {canRead ? (
                      item.chart_of_account ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 12,
                              color: "var(--foreground-muted)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {item.chart_of_account.code}
                          </span>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: "var(--foreground)",
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                            }}
                          >
                            {item.chart_of_account.name}
                          </span>
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--foreground-muted)",
                          }}
                        >
                          —
                        </span>
                      )
                    ) : (
                      "***"
                    )}
                  </td>
                  <td style={tdStyle}>
                    {canRead ? (
                      <span
                        title={
                          item.is_active === false
                            ? "Hidden from payment pickers"
                            : undefined
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          background:
                            item.is_active === false
                              ? "var(--background)"
                              : "var(--success-bg)",
                          color:
                            item.is_active === false
                              ? "var(--foreground-muted)"
                              : "var(--success)",
                          border:
                            item.is_active === false
                              ? "1px solid var(--border)"
                              : "1px solid transparent",
                        }}
                      >
                        {item.is_active === false ? "Inactive" : "Active"}
                      </span>
                    ) : (
                      "***"
                    )}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: "var(--foreground-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {canRead
                      ? item.created_at
                        ? formatDateShort(item.created_at)
                        : "—"
                      : "***"}
                  </td>
                  <td style={tdStyle}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        title="View"
                        style={{
                          width: 32,
                          height:32,
                          background: "none",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          color: "var(--foreground-muted)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(item);
                            setName(item.name);
                            setType(item.type || "all");
                            setChartOfAccountId(
                              item.chart_of_account_id ?? null,
                            );
                            setRequiresSettlement(!!item.requires_settlement);
                            setFeeAccountId(
                              item.settlement_fee_chart_of_account_id ?? null,
                            );
                            setIsActive(item.is_active !== false);
                            setShowForm(true);
                          }}
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--surface)",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                        Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          style={{
                            height:32,
                            fontSize: 12,
                            padding: "0 14px",
                            border: "1px solid var(--destructive)",
                            borderRadius: "var(--radius-sm)",
                            background: "transparent",
                            cursor: "pointer",
                            color: "var(--destructive)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            role="presentation"
            onClick={() => setShowForm(false)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.18)",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 50,
              width: "100%",
              maxWidth: 440,
              height: "100%",
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                {editing ? "Edit Payment Method" : "New Payment Method"}
              </span>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "var(--foreground-muted)",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
              {editing?.bank_account_id && (
                <div
                  style={{
                    padding: 12,
                    marginBottom: 16,
                    background: "var(--warning-bg)",
                    border: "1px solid var(--warning)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--warning)",
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  Linked to bank account{" "}
                  <strong>
                    {editing.bank_account?.bank_name ?? "Bank"}{" "}
                    {editing.bank_account?.account_number ?? ""}
                  </strong>
                  . The bank link itself cannot be changed here — only name,
                  type, and COA.
                </div>
              )}
              <label
                style={{
                  fontSize: 13,
                  color: "var(--foreground-muted)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Method Name *
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cash, Transfer BCA, QRIS"
                style={{
                  width: "100%",
                  height: 40,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0 12px",
                  fontSize: 14,
                  color: "var(--foreground)",
                  background: "var(--surface-raised)",
                  boxSizing: "border-box",
                }}
              />
              <p
                style={{
                  fontSize: 12,
                  color: "var(--foreground-muted)",
                  marginTop: 6,
                }}
              >
                Tip: include &quot;cash&quot; in the name (e.g.
                &quot;Cash&quot;) to enable change calculation in POS.
              </p>
              <label
                style={{
                  fontSize: 13,
                  color: "var(--foreground-muted)",
                  display: "block",
                  marginBottom: 6,
                  marginTop: 16,
                }}
              >
                Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "0 12px",
                  fontSize: 14,
                  color: "var(--foreground)",
                  background: "var(--surface-raised)",
                  boxSizing: "border-box",
                }}
              >
                <option value="all">All</option>
                <option value="sales_orders">Sales Orders</option>
                <option value="purchase_orders">Purchase Orders</option>
              </select>
              <MoneyDestination
                type={type}
                requiresSettlement={requiresSettlement}
                onRequiresSettlementChange={setRequiresSettlement}
                chartOfAccountId={chartOfAccountId}
                onChartOfAccountChange={setChartOfAccountId}
                accountOptions={coaSelectOptions}
                accountsLoading={chartOfAccountsLoading}
                feeAccountId={feeAccountId}
                onFeeAccountChange={setFeeAccountId}
                feeAccountOptions={feeAccountOptions}
                feeAccountsLoading={feeAccountsLoading}
              />
              {editing?.bank_account_id ? (
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--foreground-muted)",
                    marginTop: 16,
                  }}
                >
                  Active / inactive follows the linked bank account (Accounting
                  → Bank Accounts).
                </p>
              ) : (
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    marginTop: 16,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--foreground)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    Active
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "var(--foreground-muted)",
                        marginTop: 2,
                      }}
                    >
                      Inactive methods are hidden when choosing a payment
                      method; past payments keep it.
                    </span>
                  </span>
                </label>
              )}
            </div>
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: 12,
              }}
            >
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  flex: 1,
                  height: 42,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!name.trim()) {
                    toast.error("Name is required");
                    return;
                  }
                  save();
                }}
                disabled={saving}
                style={{
                  flex: 1,
                  height: 42,
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  background: "var(--accent)",
                  color: "white",
                  cursor: saving ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : editing ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 40,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={() => setSelectedItem(null)}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.18)",
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 50,
              width: 760,
              maxWidth: "100vw",
              height: "100%",
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-lg)",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 20,
                      fontWeight: 500,
                      margin: 0,
                      color: "var(--foreground)",
                    }}
                  >
                    {selectedItem.name}
                  </h2>
                  {selectedItem.type && (
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: "var(--accent-light-bg)",
                        color: "var(--accent)",
                      }}
                    >
                      {selectedItem.type}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: "var(--foreground-muted)" }}>
                  ID {selectedItem.id}
                  {selectedItem.created_at ? ` · Dibuat ${formatDateTime(selectedItem.created_at)}` : ""}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  display: "flex",
                }}
              >
                <X size={18} color="var(--foreground-muted)" />
              </button>
            </div>
            <div
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                  padding: 14,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--background)",
                }}
              >
                {[
                  {
                    label: "Akun default (COA)",
                    value: selectedItem.chart_of_account?.name ?? "—",
                    sub: selectedItem.chart_of_account?.code,
                  },
                ].map((f) => (
                  <div key={f.label} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground-muted)" }}>
                      {f.label}
                    </span>
                    <span style={{ fontSize: 14, color: "var(--foreground)" }}>{f.value}</span>
                    {f.sub && (
                      <span style={{ fontSize: 11, color: "var(--foreground-muted)" }}>{f.sub}</span>
                    )}
                  </div>
                ))}
              </div>
              <PaymentMethodBranchAccounts
                paymentMethodId={Number(selectedItem.id)}
                canEdit={canEdit}
                defaultAccount={selectedItem.chart_of_account}
              />
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-xl)",
              padding: 32,
              width: 360,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 18,
                marginBottom: 8,
              }}
            >
              Delete Payment Method
            </h3>
            <p
              style={{
                fontSize: 14,
                color: "var(--foreground-muted)",
                marginBottom: 24,
              }}
            >
              Delete <strong>{deleteTarget.name}</strong>? This cannot be
              undone.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  height: 40,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doDelete(deleteTarget.id)}
                disabled={deleting}
                style={{
                  flex: 1,
                  height: 40,
                  border: "none",
                  borderRadius: "var(--radius-md)",
                  background: "var(--destructive)",
                  color: "white",
                  cursor: deleting ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// "Where does the money go?" — the one accounting decision a payment method
// needs, phrased for cashiers rather than as a raw Chart of Account picker.
function MoneyDestination({
  type,
  requiresSettlement,
  onRequiresSettlementChange,
  chartOfAccountId,
  onChartOfAccountChange,
  accountOptions,
  accountsLoading,
  feeAccountId,
  onFeeAccountChange,
  feeAccountOptions,
  feeAccountsLoading,
}: {
  type: string;
  requiresSettlement: boolean;
  onRequiresSettlementChange: (v: boolean) => void;
  chartOfAccountId: number | null;
  onChartOfAccountChange: (v: number | null) => void;
  accountOptions: { value: number; label: string; sublabel?: string }[];
  accountsLoading: boolean;
  feeAccountId: number | null;
  onFeeAccountChange: (v: number | null) => void;
  feeAccountOptions: { value: number; label: string; sublabel?: string }[];
  feeAccountsLoading: boolean;
}) {
  const isPurchase = type === "purchase_orders";
  const settleLater = !isPurchase && requiresSettlement;

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--foreground-muted)",
    display: "block",
    marginBottom: 6,
  };
  const hintStyle: React.CSSProperties = {
    fontSize: 12,
    color: "var(--foreground-muted)",
    marginTop: 6,
    lineHeight: 1.5,
  };
  const triggerStyle: React.CSSProperties = {
    height: 40,
    padding: "0 12px",
    fontSize: 14,
    borderRadius: "var(--radius-sm)",
  };
  const optionStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: "var(--radius-md)",
    background: active ? "var(--accent-light-bg)" : "var(--surface)",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--foreground)",
  });
  const sub: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    color: "var(--foreground-muted)",
    marginTop: 2,
    fontWeight: 400,
  };

  const accountPicker = (
    <div style={{ marginTop: 12 }}>
      <label style={labelStyle}>
        {isPurchase ? "Paid from (Kas / Bank) *" : "Kas / Bank account *"}
      </label>
      <SearchableSelect
        value={chartOfAccountId ?? 0}
        onChange={(val: any) =>
          onChartOfAccountChange(val && Number(val) > 0 ? Number(val) : null)
        }
        options={accountOptions}
        placeholder="— Choose account —"
        searchPlaceholder="Search bank, account number or code..."
        loading={accountsLoading}
        triggerStyle={triggerStyle}
      />
    </div>
  );

  if (isPurchase) {
    return (
      <div style={{ marginTop: 20 }}>
        {accountPicker}
        <p style={hintStyle}>
          Supplier payments with this method are paid out of this account.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 20 }}>
      <span style={{ ...labelStyle, fontWeight: 600, color: "var(--foreground)" }}>
        When a customer pays with this method, where does the money go?
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={optionStyle(!settleLater)}>
          <input
            type="radio"
            name="money-destination"
            checked={!settleLater}
            onChange={() => onRequiresSettlementChange(false)}
            style={{ marginTop: 2 }}
          />
          <span style={{ fontWeight: 600 }}>
            Straight into Kas / Bank
            <span style={sub}>
              The money is there right away — cash in the drawer, bank
              transfer, QRIS.
            </span>
          </span>
        </label>
        <label style={optionStyle(settleLater)}>
          <input
            type="radio"
            name="money-destination"
            checked={settleLater}
            onChange={() => onRequiresSettlementChange(true)}
            style={{ marginTop: 2 }}
          />
          <span style={{ fontWeight: 600 }}>
            Settle later (Piutang first)
            <span style={sub}>
              The money arrives days later — Visa / Mastercard, BCA EDC, cash
              deposited later. It waits in Piutang Dagang until you record it
              in Settlements → Offline Orders.
            </span>
          </span>
        </label>
      </div>

      {!settleLater && accountPicker}

      {settleLater && (
        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>Default fee account (biaya admin / MDR)</label>
          <SearchableSelect
            value={feeAccountId ?? 0}
            onChange={(val: any) =>
              onFeeAccountChange(val && Number(val) > 0 ? Number(val) : null)
            }
            options={feeAccountOptions}
            placeholder="— None —"
            searchPlaceholder="Search account name or code..."
            loading={feeAccountsLoading}
            triggerStyle={triggerStyle}
          />
          <p style={hintStyle}>
            You choose which bank the money landed in when you settle. This
            account is pre-filled for the fee the bank keeps, and can be
            changed there.
          </p>
        </div>
      )}
    </div>
  );
}
