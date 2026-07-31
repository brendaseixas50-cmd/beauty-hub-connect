import type { TenantContext, TenantScopedEntity } from "./domain";

/**
 * Every private repository receives a mandatory TenantContext. Implementations
 * must apply tenant_id filters in addition to Supabase RLS defense in depth.
 */
export interface TenantRepository<TEntity extends TenantScopedEntity> {
  list(context: TenantContext): Promise<readonly TEntity[]>;
  findById(context: TenantContext, id: string): Promise<TEntity | null>;
  create(
    context: TenantContext,
    input: Omit<TEntity, "id" | "tenantId" | "createdAt" | "updatedAt">,
  ): Promise<TEntity>;
  update(context: TenantContext, id: string, input: Partial<TEntity>): Promise<TEntity>;
}
