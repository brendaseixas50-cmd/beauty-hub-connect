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

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
  permissions: readonly Permission[];
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
