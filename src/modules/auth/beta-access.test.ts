import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBetaAccess, type PlatformGrant } from "./beta-access";

const now = Date.parse("2026-08-14T12:00:00.000Z");

function grant(overrides: Partial<PlatformGrant> = {}): PlatformGrant {
  return {
    productType: "beauty",
    accessType: "beta_tester",
    status: "active",
    startsAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    ...overrides,
  };
}

describe("resolveBetaAccess", () => {
  it("mantém usuário sem concessão como pendente de aprovação", () => {
    assert.deepEqual(resolveBetaAccess([], "beauty", now), {
      status: "pending",
      accessType: null,
    });
  });

  it("não libera acesso concedido a outro produto", () => {
    assert.equal(
      resolveBetaAccess([grant({ productType: "barber" })], "beauty", now).status,
      "pending",
    );
  });

  it("libera apenas concessão ativa dentro da vigência", () => {
    assert.deepEqual(resolveBetaAccess([grant()], "beauty", now), {
      status: "approved",
      accessType: "beta_tester",
    });
  });

  it("bloqueia concessões suspensas ou revogadas", () => {
    assert.equal(
      resolveBetaAccess([grant({ status: "suspended" })], "beauty", now).status,
      "suspended",
    );
    assert.equal(
      resolveBetaAccess([grant({ status: "revoked" })], "beauty", now).status,
      "revoked",
    );
  });

  it("bloqueia concessão vencida ou com início futuro", () => {
    assert.equal(
      resolveBetaAccess([grant({ expiresAt: "2026-08-01T00:00:00.000Z" })], "beauty", now).status,
      "expired",
    );
    assert.equal(
      resolveBetaAccess([grant({ startsAt: "2026-12-01T00:00:00.000Z" })], "beauty", now).status,
      "pending",
    );
  });
});
