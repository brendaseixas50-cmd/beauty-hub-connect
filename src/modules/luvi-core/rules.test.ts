import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateLuviRules } from "./rules.ts";
import type { LuviContextSnapshot } from "./types.ts";

function context(overrides: Partial<LuviContextSnapshot> = {}): LuviContextSnapshot {
  return {
    product: "beauty",
    tenantId: "tenant-a",
    userId: "user-a",
    pathname: "/painel",
    permissions: ["dashboard:read"],
    facts: {},
    ...overrides,
  };
}

describe("Luvi Core rule engine", () => {
  it("limits visible guidance to one primary and two secondary suggestions", () => {
    const suggestions = evaluateLuviRules(
      context({ facts: { appointmentsToday: 3, lowStock: 2, pendingAppointments: 1 } }),
    );
    assert.ok(suggestions.length <= 3);
    assert.equal(suggestions[0]?.id, "dashboard-low-stock");
  });

  it("adapts dashboard language to LuBarber without changing the rule", () => {
    const [suggestion] = evaluateLuviRules(
      context({ product: "barber", facts: { appointmentsToday: 2 } }),
    );
    assert.ok(suggestion);
    assert.match(suggestion.title, /atendimentos/i);
    assert.equal(suggestion.action?.to, "/painel/agenda");
  });

  it("uses only facts received from the active screen", () => {
    const [suggestion] = evaluateLuviRules(
      context({ pathname: "/painel/clientes", facts: { clients: 0 } }),
    );
    assert.ok(suggestion);
    assert.equal(suggestion.id, "clients-empty");
    assert.equal(suggestion.action?.to, "/painel/clientes");
  });
});
