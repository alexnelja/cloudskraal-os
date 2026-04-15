export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return '';
  if (meters < 1000) return `${Math.floor(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatArea(squareMeters: number | null | undefined): string {
  if (squareMeters == null) return '';
  if (squareMeters < 10_000) return `${Math.floor(squareMeters)} m²`;
  return `${(squareMeters / 10_000).toFixed(2)} ha`;
}
