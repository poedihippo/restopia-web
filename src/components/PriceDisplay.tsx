import React from 'react'
import { usePrice } from '@/hooks/usePrice'

interface PriceDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | null | undefined
  prefix?: string
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({ amount, prefix = 'Rp ', ...props }) => {
  const { formatPrice } = usePrice()
  
  return <span {...props}>{formatPrice(amount, prefix)}</span>
}
