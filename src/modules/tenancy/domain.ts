export type TenantId = string;

export interface TenantScopedEntity {
  id: string;
  tenantId: TenantId;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: TenantId;
  slug: string;
  name: string;
  status: "active" | "suspended";
}

export interface TenantContext {
  tenantId: TenantId;
  userId: string;
}

export function assertTenantAccess(context: TenantContext, entity: TenantScopedEntity): void {
  if (context.tenantId !== entity.tenantId) {
    throw new Error("Cross-tenant access denied");
  }
}
