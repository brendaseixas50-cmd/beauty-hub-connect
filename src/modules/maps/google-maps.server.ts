type GoogleMapsCoordinates = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

type GoogleGeocodingResponse = {
  status?: string;
  error_message?: string;
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
  if (!address.trim()) return null;
  if (!apiKey) {
    console.warn("[google-geocoding] GOOGLE_MAPS_SERVER_API_KEY is unavailable in the runtime");
    return null;
  }

  const endpoint = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  endpoint.searchParams.set("address", address.trim());
  endpoint.searchParams.set("key", apiKey);
  endpoint.searchParams.set("language", "pt-BR");
  endpoint.searchParams.set("region", "br");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    console.warn("[google-geocoding] request failed", {
      cause: sanitizeDiagnostic(cause instanceof Error ? cause.message : "unknown error", apiKey),
    });
    return null;
  }
  if (!response.ok) {
    console.warn("[google-geocoding] unexpected HTTP response", { httpStatus: response.status });
    return null;
  }

  const payload = (await response.json()) as GoogleGeocodingResponse;
  if (payload.status !== "OK") {
    console.warn("[google-geocoding] provider rejected the request", {
      providerStatus: payload.status ?? "MISSING_STATUS",
      providerMessage: sanitizeDiagnostic(payload.error_message ?? "", apiKey),
    });
    return null;
  }
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

function sanitizeDiagnostic(value: string, apiKey: string) {
  return value.replaceAll(apiKey, "[redacted]").slice(0, 500);
}
