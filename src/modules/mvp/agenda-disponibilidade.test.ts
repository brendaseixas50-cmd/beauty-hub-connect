import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseWorkingHours, professionalSlotBlockReason } from "./agenda-disponibilidade.ts";

const timeZone = "America/Sao_Paulo";

const hours = parseWorkingHours({
  "1": { startsAt: "09:00", endsAt: "18:00", breakStartsAt: "12:00", breakEndsAt: "13:00" },
  "2": { dayOff: true },
});

describe("individual professional availability", () => {
  it("accepts a slot inside the professional working hours", () => {
    assert.equal(
      professionalSlotBlockReason({
        workingHours: hours,
        timeZone,
        startsAt: "2026-08-17T13:00:00.000Z", // Monday 10:00 local
        endsAt: "2026-08-17T14:00:00.000Z",
      }),
      null,
    );
  });

  it("rejects a slot on the professional day off", () => {
    assert.ok(
      professionalSlotBlockReason({
        workingHours: hours,
        timeZone,
        startsAt: "2026-08-18T13:00:00.000Z", // Tuesday
        endsAt: "2026-08-18T14:00:00.000Z",
      }),
    );
  });

  it("rejects a slot overlapping the break", () => {
    assert.ok(
      professionalSlotBlockReason({
        workingHours: hours,
        timeZone,
        startsAt: "2026-08-17T15:30:00.000Z", // Monday 12:30 local
        endsAt: "2026-08-17T16:00:00.000Z",
      }),
    );
  });

  it("rejects a slot inside a personal block", () => {
    assert.ok(
      professionalSlotBlockReason({
        workingHours: hours,
        timeZone,
        startsAt: "2026-08-17T13:00:00.000Z",
        endsAt: "2026-08-17T14:00:00.000Z",
        unavailability: [
          { starts_at: "2026-08-17T12:00:00.000Z", ends_at: "2026-08-17T18:00:00.000Z" },
        ],
      }),
    );
  });

  it("follows the company hours when the professional has no custom schedule", () => {
    assert.equal(
      professionalSlotBlockReason({
        workingHours: {},
        timeZone,
        startsAt: "2026-08-18T13:00:00.000Z",
        endsAt: "2026-08-18T14:00:00.000Z",
      }),
      null,
    );
  });
});
