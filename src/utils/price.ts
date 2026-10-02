import { formatNumberId } from './numberFormat'

let globalCanReadPrice = true;
export function getCanReadPrice() { return globalCanReadPrice; }

export function setPricePermission(allowed: boolean) {
  globalCanReadPrice = allowed;
}

export function formatCurrency(value: number | string | null | undefined, prefix: string = 'Rp ') {
  if (!globalCanReadPrice) return `${prefix}***`;

  return `${prefix}${formatNumberId(value, 2)}`;
}

/** Display amount without "Rp" prefix — id-ID format (1.500,50) */
export function formatAmount(value: number | string | null | undefined, decimals = 2) {
  return formatNumberId(value, decimals);
}
