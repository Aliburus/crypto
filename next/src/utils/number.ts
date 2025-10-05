export function parseFlexibleNumber(raw: string): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s|_/g, "").replace(/,/g, ".");
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function formatLocaleNumber(
  value: number,
  options?: Intl.NumberFormatOptions
) {
  try {
    return new Intl.NumberFormat("en-US", options).format(value);
  } catch {
    return String(value);
  }
}

export function formatUsdPrice(value: number): string {
  const v = Number(value) || 0;
  let options: Intl.NumberFormatOptions;
  if (v >= 1) {
    options = {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };
  } else if (v >= 0.01) {
    options = {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    };
  } else if (v > 0) {
    options = {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 6,
      maximumFractionDigits: 8,
    };
  } else {
    options = {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };
  }
  return formatLocaleNumber(v, options);
}
