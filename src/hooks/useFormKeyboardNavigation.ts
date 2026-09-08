import { useEffect } from 'react'

interface UseFormKeyboardNavigationOptions {
  onAddItem?: () => void
  disabled?: boolean
}

/**
 * Hook to handle form keyboard shortcuts:
 * - Ctrl+B / Cmd+B: Add a new item / row to the form table
 */
export function useFormKeyboardNavigation({
  onAddItem,
  disabled = false,
}: UseFormKeyboardNavigationOptions) {
  useEffect(() => {
    if (disabled || !onAddItem) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Trigger on Ctrl+B or Cmd+B
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        e.stopPropagation()
        onAddItem()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onAddItem, disabled])
}

export default useFormKeyboardNavigation
