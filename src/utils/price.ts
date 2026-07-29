let globalCanReadPrice = true;
export function getCanReadPrice() { return globalCanReadPrice; }

export function setPricePermission(allowed: boolean) {
  globalCanReadPrice = allowed;
}

export function formatCurrency(value: number | string | null | undefined, prefix: string = 'Rp ') {
  if (!globalCanReadPrice) return `${prefix}***`;
  
  const numValue = typeof value === 'string' ? Number(value) : (value ?? 0);
  return `${prefix}${numValue.toLocaleString('id-ID')}`;
}
