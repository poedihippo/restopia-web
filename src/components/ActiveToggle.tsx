'use client'

/**
 * Segmented Active / Inactive toggle for `is_active` form fields — the same
 * `v2-seg` control the PO / Receipt forms use for Pending / Final, so every
 * boolean status in the app looks and behaves alike.
 *
 * Use with react-hook-form via Controller:
 *   <Controller name="is_active" control={control}
 *     render={({ field }) => <ActiveToggle value={field.value} onChange={field.onChange} />} />
 */
interface ActiveToggleProps {
  value: boolean | undefined
  onChange: (value: boolean) => void
  activeLabel?: string
  inactiveLabel?: string
}

export default function ActiveToggle({
  value,
  onChange,
  activeLabel = 'Active',
  inactiveLabel = 'Inactive',
}: ActiveToggleProps) {
  return (
    <div className="v2-seg" style={{ alignSelf: 'flex-start' }}>
      {([true, false] as const).map((val) => {
        const isSelected = value === val
        return (
          <button
            key={String(val)}
            type="button"
            aria-selected={isSelected}
            onClick={() => onChange(val)}
            style={
              isSelected
                ? { color: val ? 'var(--success)' : 'var(--destructive)', fontWeight: 600 }
                : undefined
            }
          >
            {val ? activeLabel : inactiveLabel}
          </button>
        )
      })}
    </div>
  )
}
