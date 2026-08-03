import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getPermissionsForRole, selectActiveCompany, type CompanyAccess } from "./domain.ts";

const beauty: CompanyAccess = {
  tenantId: "beauty-tenant",
  tenantName: "Salão da Lu",
  tenantSlug: "salao-da-lu",
  productType: "beauty",
  role: "owner",
  permissions: getPermissionsForRole("owner"),
};

const barber: CompanyAccess = {
  tenantId: "barber-tenant",
  tenantName: "Barbearia da Lu",
  tenantSlug: "barbearia-da-lu",
  productType: "barber",
  role: "receptionist",
  permissions: getPermissionsForRole("receptionist"),
};

describe("multi-company authentication domain", () => {
  it("selects the persisted active company", () => {
    assert.equal(selectActiveCompany([beauty, barber], barber.tenantId), barber);
  });

  it("falls back to the first authorized company for a stale tenant id", () => {
    assert.equal(selectActiveCompany([beauty, barber], "removed-tenant"), beauty);
  });

  it("keeps permissions independent for each company membership", () => {
    assert.ok(beauty.permissions.includes("settings:manage"));
    assert.ok(!barber.permissions.includes("settings:manage"));
  });
});
