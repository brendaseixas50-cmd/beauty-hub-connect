import assert from "node:assert/strict";
import test from "node:test";

import { resolveAddressWithGoogleMaps } from "./google-maps.server.ts";

test("geocodes a Brazilian address only through the server adapter", async () => {
  const previousKey = process.env["GOOGLE_MAPS_SERVER_API_KEY"];
  const previousFetch = globalThis.fetch;
  process.env["GOOGLE_MAPS_SERVER_API_KEY"] = "test-server-key";
  let requestedUrl = "";
  globalThis.fetch = (async (input) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({
        status: "OK",
        results: [
          {
            formatted_address: "Rua Dois, 63 - Jari, Maracanaú - CE, Brasil",
            geometry: { location: { lat: -3.867, lng: -38.626 } },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const result = await resolveAddressWithGoogleMaps("Rua Dois, 63, Maracanaú, CE");
    assert.deepEqual(result, {
      latitude: -3.867,
      longitude: -38.626,
      formattedAddress: "Rua Dois, 63 - Jari, Maracanaú - CE, Brasil",
    });
    const url = new URL(requestedUrl);
    assert.equal(url.origin, "https://maps.googleapis.com");
    assert.equal(url.searchParams.get("key"), "test-server-key");
    assert.equal(url.searchParams.get("region"), "br");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env["GOOGLE_MAPS_SERVER_API_KEY"];
    else process.env["GOOGLE_MAPS_SERVER_API_KEY"] = previousKey;
  }
});

test("returns null without a server key and does not call Google", async () => {
  const previousKey = process.env["GOOGLE_MAPS_SERVER_API_KEY"];
  const previousFetch = globalThis.fetch;
  delete process.env["GOOGLE_MAPS_SERVER_API_KEY"];
  globalThis.fetch = (async () => {
    throw new Error("fetch should not be called");
  }) as typeof fetch;

  try {
    assert.equal(await resolveAddressWithGoogleMaps("Rua Dois, 63"), null);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey !== undefined) process.env["GOOGLE_MAPS_SERVER_API_KEY"] = previousKey;
  }
});
