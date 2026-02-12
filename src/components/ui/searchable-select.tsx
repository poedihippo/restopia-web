import ReactSelect, { Props as ReactSelectProps } from "react-select";

export interface SelectOption {
  value: number;
  label: string;
}

type SearchableSelectProps = Omit<
  ReactSelectProps<SelectOption, boolean>,
  "classNames" | "styles"
>;

export const SearchableSelect = (props: SearchableSelectProps) => {
  return (
    <ReactSelect<SelectOption, boolean>
      {...props}
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
          zIndex: 50,
        }),
      }}
    />
  );
};
