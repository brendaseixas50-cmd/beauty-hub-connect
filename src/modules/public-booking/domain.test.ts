import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { availabilitySchema, bookingResultSchema, publicPageSchema } from "./domain.ts";

describe("premium public booking contracts", () => {
  it("accepts multi-service availability with professionals", () => {
    const parsed = availabilitySchema.parse({
      date: "2026-08-04",
      slots: [
        {
          startsAt: "2026-08-04T12:00:00.000Z",
          endsAt: "2026-08-04T13:30:00.000Z",
          professionals: [{ id: "00000000-0000-4000-8000-000000000001", name: "Lu" }],
        },
      ],
    });
    assert.equal(parsed.slots[0]?.professionals[0]?.name, "Lu");
  });

  it("accepts a saved booking with a development notification", () => {
    const parsed = bookingResultSchema.parse({
      ok: true,
      appointmentId: "00000000-0000-4000-8000-000000000002",
      services: ["Corte", "Escova"],
      professional: "Lu",
      totalPriceCents: 12500,
      notificationStatus: "development",
      whatsapp: "+5585999999999",
    });
    assert.equal(parsed.notificationStatus, "development");
    assert.equal(parsed.services?.length, 2);
  });

  it("requires all premium company theme colors", () => {
    const result = publicPageSchema.safeParse({ company: {}, services: [], professionals: [] });
    assert.equal(result.success, false);
  });
});
