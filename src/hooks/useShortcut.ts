import { useEffect } from 'react'

interface UseShortcutProps {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  onAction: () => void
  enabled?: boolean
}

export function useShortcut({
  key,
  ctrlKey = false,
  altKey = false,
  shiftKey = false,
  onAction,
  enabled = true,
}: UseShortcutProps) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        e.ctrlKey === ctrlKey &&
        e.altKey === altKey &&
        e.shiftKey === shiftKey
      ) {
        e.preventDefault()
        onAction()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, ctrlKey, altKey, shiftKey, onAction, enabled])
}
