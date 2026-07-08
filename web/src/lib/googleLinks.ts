export function googleMapsSearchUrl(businessName: string, location?: string | null): string {
  const query = [businessName, location].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function googleSearchUrl(businessName: string, location?: string | null): string {
  const query = [businessName, location].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
