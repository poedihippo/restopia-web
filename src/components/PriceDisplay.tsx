import React from 'react'
import { formatCurrency } from '@/utils/price';

interface PriceDisplayProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | null | undefined
  prefix?: string
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({ amount, prefix = 'Rp ', ...props }) => {
  return <span {...props}>{formatCurrency(amount, prefix)}</span>
}
