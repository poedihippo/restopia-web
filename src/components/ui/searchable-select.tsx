import ReactSelect, { Props as ReactSelectProps } from "react-select";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export interface SelectOption {
  value: number;
  label: string;
  /** react-select greys out and skips options with this set. */
  isDisabled?: boolean;
  /** Group header (e.g. a branch's company); consecutive options with the same group are grouped. */
  group?: string;
  /** Nesting level shown with an arrow (e.g. 1 = pickup point under its premiere). */
  indent?: number;
}

// Flat options carrying `group` become react-select groups, keeping their order.
// Callers keep passing (and looking values up in) the flat list.
function toGrouped(options: readonly SelectOption[]) {
  const groups: { label: string; options: SelectOption[] }[] = [];
  for (const o of options) {
    const label = o.group ?? "";
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.options.push(o);
    else groups.push({ label, options: [o] });
  }
  return groups;
}

type SearchableSelectProps = Omit<
  ReactSelectProps<SelectOption, boolean>,
  "classNames" | "styles"
> & {
  onSearchChange?: (val: string) => void;
  /** Paged sources (see useInfiniteOptions): called when the menu is scrolled to the bottom. */
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
};

export const SearchableSelect = (props: SearchableSelectProps) => {
  const { user } = useAuth();
  const { onLoadMore, hasMore, loadingMore, ...selectProps } = props;
  const { value, options, placeholder, onChange } = selectProps;

  useEffect(() => {
    const lowerPlaceholder = typeof placeholder === 'string' ? placeholder.toLowerCase() : '';
    const isOwnBranchSelect =
      lowerPlaceholder.includes('branch') &&
      !lowerPlaceholder.includes('target') &&
      !lowerPlaceholder.includes('supplier') &&
      !lowerPlaceholder.includes('buyer')

    if (!value && user?.branch_id && isOwnBranchSelect && options && onChange) {
      const branchOpt = (options as SelectOption[]).find((o) => o.value === user.branch_id);
      if (branchOpt) {
        onChange(branchOpt, { action: "select-option", option: branchOpt });
      }
    }
  }, [value, user, placeholder, options, onChange]);

  const flat = (options ?? []) as SelectOption[];
  const hasGroups = flat.some((o) => o && typeof o === "object" && "group" in o && o.group);
  const hasIndent = flat.some((o) => o && typeof o === "object" && (o.indent ?? 0) > 0);

  return (
    <ReactSelect<SelectOption, boolean>
      {...selectProps}
      {...(hasGroups ? { options: toGrouped(flat) as any } : {})}
      {...(hasIndent && !selectProps.formatOptionLabel
        ? {
            formatOptionLabel: (o: SelectOption, meta: any) =>
              meta?.context === "menu" && (o.indent ?? 0) > 0 ? (
                <span style={{ paddingLeft: (o.indent ?? 0) * 14 }}>
                  <span style={{ color: "var(--foreground-subtle)", marginRight: 4 }}>↳</span>
                  {o.label}
                </span>
              ) : (
                o.label
              ),
          }
        : {})}
      isLoading={selectProps.isLoading || loadingMore}
      onMenuScrollToBottom={(e) => {
        selectProps.onMenuScrollToBottom?.(e);
        if (hasMore && !loadingMore) onLoadMore?.();
      }}
      onInputChange={(val, meta) => {
        if (selectProps.onInputChange) selectProps.onInputChange(val, meta);
        if (selectProps.onSearchChange && meta.action === 'input-change') selectProps.onSearchChange(val);
      }}
      classNames={{
        control: () =>
          "!border-input !bg-background !shadow-sm !min-h-9 !rounded-md",
        menu: () => "!bg-background !border !border-input",
        option: ({ isFocused, isSelected }) =>
          isSelected
            ? "!bg-primary !text-primary-foreground"
            : isFocused
              ? "!bg-accent !text-accent-foreground"
              : "!bg-background !text-foreground",
        multiValue: () => "!bg-accent !rounded-md",
        multiValueLabel: () => "!text-accent-foreground",
        multiValueRemove: () =>
          "!text-accent-foreground hover:!bg-destructive hover:!text-destructive-foreground !rounded-r-md",
        input: () => "!text-foreground",
        placeholder: () => "!text-muted-foreground",
        singleValue: () => "!text-foreground",
      }}
      styles={{
        control: (base) => ({
          ...base,
          fontSize: "14px",
        }),
        menu: (base) => ({
          ...base,
          zIndex: 9999,
        }),
      }}
    />
  );
};
