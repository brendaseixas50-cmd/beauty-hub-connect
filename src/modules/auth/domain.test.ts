import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getPermissionsForRole,
  selectActiveCompany,
  selectCompanyForProduct,
  type CompanyAccess,
} from "./domain.ts";

const beauty: CompanyAccess = {
  tenantId: "beauty-tenant",
  tenantName: "Salão da Lu",
  tenantSlug: "salao-da-lu",
  logoUrl: null,
  productType: "beauty",
  onboardingCompleted: true,
  licenseStatus: "active",
  role: "owner",
  permissions: getPermissionsForRole("owner"),
  betaAccessActive: true,
  betaAccessStatus: "approved",
  betaAccessType: "administrator",
};

const barber: CompanyAccess = {
  tenantId: "barber-tenant",
  tenantName: "Barbearia da Lu",
  tenantSlug: "barbearia-da-lu",
  logoUrl: null,
  productType: "barber",
  onboardingCompleted: true,
  licenseStatus: "active",
  role: "receptionist",
  permissions: getPermissionsForRole("receptionist"),
  betaAccessActive: true,
  betaAccessStatus: "approved",
  betaAccessType: "beta_tester",
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

  it("selects the requested LuBeauty or LuBarber company", () => {
    assert.equal(selectCompanyForProduct([beauty, barber], "beauty"), beauty);
    assert.equal(selectCompanyForProduct([beauty, barber], "barber"), barber);
    assert.equal(selectCompanyForProduct([beauty, barber], undefined), undefined);
  });
});
