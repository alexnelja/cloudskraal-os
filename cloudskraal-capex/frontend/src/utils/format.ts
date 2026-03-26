export function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatYears(years: number): string {
  return `${years.toFixed(1)} years`;
}

export function formatCompactZAR(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `R ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `R ${(amount / 1_000).toFixed(0)}K`;
  }
  return formatZAR(amount);
}

export function parseZARInput(value: string): number {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
