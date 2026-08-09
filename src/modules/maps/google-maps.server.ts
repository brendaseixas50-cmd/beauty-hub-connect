type GoogleMapsCoordinates = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

type GoogleGeocodingResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  }>;
};

/**
 * Server-only adapter reserved for Google Maps Platform features that require a key.
 * The current public map intentionally uses Google's keyless embed and directions URLs.
 */
export async function resolveAddressWithGoogleMaps(
  address: string,
): Promise<GoogleMapsCoordinates | null> {
  const apiKey = process.env["GOOGLE_MAPS_SERVER_API_KEY"]?.trim();
  if (!apiKey || !address.trim()) return null;

  const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  endpoint.searchParams.set("address", address.trim());
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("language", "pt-BR");
  endpoint.searchParams.set("region", "br");

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as GoogleGeocodingResponse;
  const result = payload.status === "OK" ? payload.results?.[0] : undefined;
  const latitude = result?.geometry?.location?.lat;
  const longitude = result?.geometry?.location?.lng;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;

  return {
    latitude,
    longitude,
    formattedAddress: result?.formatted_address || address.trim(),
  };
}
