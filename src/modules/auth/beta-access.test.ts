import { describe, expect, it } from "vitest";

import { resolveBetaAccess } from "./session.server";

const now = Date.parse("2026-08-14T12:00:00.000Z");

function grant(overrides: Partial<Parameters<typeof resolveBetaAccess>[0][number]> = {}) {
  return {
    productType: "beauty" as const,
    accessType: "beta_tester" as const,
    status: "active" as const,
    startsAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    ...overrides,
  };
}

describe("resolveBetaAccess", () => {
  it("mantém usuário sem concessão como pendente de aprovação", () => {
    expect(resolveBetaAccess([], "beauty", now)).toEqual({ status: "pending", accessType: null });
  });

  it("não libera acesso concedido a outro produto", () => {
    expect(resolveBetaAccess([grant({ productType: "barber" })], "beauty", now).status).toBe(
      "pending",
    );
  });

  it("libera apenas concessão ativa dentro da vigência", () => {
    expect(resolveBetaAccess([grant()], "beauty", now)).toEqual({
      status: "approved",
      accessType: "beta_tester",
    });
  });

  it("bloqueia concessões suspensas ou revogadas", () => {
    expect(resolveBetaAccess([grant({ status: "suspended" })], "beauty", now).status).toBe(
      "suspended",
    );
    expect(resolveBetaAccess([grant({ status: "revoked" })], "beauty", now).status).toBe("revoked");
  });

  it("bloqueia concessão vencida ou com início futuro", () => {
    expect(
      resolveBetaAccess([grant({ expiresAt: "2026-08-01T00:00:00.000Z" })], "beauty", now).status,
    ).toBe("expired");
    expect(
      resolveBetaAccess([grant({ startsAt: "2026-12-01T00:00:00.000Z" })], "beauty", now).status,
    ).toBe("pending");
  });
});
