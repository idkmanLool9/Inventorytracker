const EUR_FORMATTER = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEUR(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return EUR_FORMATTER.format(amount);
}

export function parseEUR(input: string): number {
  // Accept "12,50" or "12.50" — typical NL input
  const normalized = input.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
