export const formatterIDR = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  style: "currency",
  currency: "IDR",
}).format;
