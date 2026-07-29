import { getCanReadPrice } from '@/utils/price';

const formatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  style: "currency",
  currency: "IDR",
}).format;

export const formatterIDR = (value: number | bigint) => {
  if (value === null || value === undefined) return '';
  if (!getCanReadPrice()) return 'Rp ***';
  return formatter(value);
};
