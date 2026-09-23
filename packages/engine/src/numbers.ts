/**
 * Parse a typed decimal that may use "." or "," as the decimal separator.
 * Thousands separators are accepted when both marks appear (1.234,5 and 1,234.5).
 * Returns null when the text is empty or not a finite number.
 */
export function parseLocaleNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return null;
  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");
  let normalized = trimmed;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized =
      lastComma > lastDot
        ? trimmed.replace(/\./g, "").replace(",", ".")
        : trimmed.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const parts = trimmed.split(",");
    normalized =
      parts.length > 2 ? trimmed.replace(/,/g, "") : trimmed.replace(",", ".");
  }
  if (!/^[-+]?\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
