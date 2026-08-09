export const roles = ["owner", "admin", "professional", "receptionist"] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "dashboard:read",
  "appointments:read",
  "appointments:write",
  "clients:read",
  "clients:write",
  "services:read",
  "services:write",
  "finance:read",
  "finance:write",
  "team:manage",
  "settings:manage",
] as const;

export type Permission = (typeof permissions)[number];

export interface CompanyAccess {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  logoUrl: string | null;
  productType: "beauty" | "barber";
  onboardingCompleted: boolean;
  licenseStatus: "trial" | "active";
  role: Role;
  permissions: readonly Permission[];
  betaAccessActive: boolean;
  betaAccessType: "administrator" | "courtesy" | "beta_tester" | null;
}

export interface AuthUser extends CompanyAccess {
  id: string;
  email: string;
  name: string;
  companies: readonly CompanyAccess[];
  isPlatformAdministrator: boolean;
}

export interface Session {
  user: AuthUser;
  expiresAt: string;
}

const permissionsByRole: Record<Role, readonly Permission[]> = {
  owner: permissions,
  admin: permissions.filter((permission) => permission !== "finance:write"),
  professional: [
    "dashboard:read",
    "appointments:read",
    "appointments:write",
    "clients:read",
    "clients:write",
    "services:read",
  ],
  receptionist: [
    "dashboard:read",
    "appointments:read",
    "appointments:write",
    "clients:read",
    "clients:write",
    "services:read",
  ],
};

export function getPermissionsForRole(role: Role): readonly Permission[] {
  return permissionsByRole[role];
}

export function can(user: AuthUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

export function selectActiveCompany(
  companies: readonly CompanyAccess[],
  activeTenantId: string | null | undefined,
): CompanyAccess | undefined {
  return companies.find((company) => company.tenantId === activeTenantId) ?? companies[0];
}

export function selectCompanyForProduct(
  companies: readonly CompanyAccess[],
  productType: "beauty" | "barber" | undefined,
): CompanyAccess | undefined {
  return productType ? companies.find((company) => company.productType === productType) : undefined;
}
