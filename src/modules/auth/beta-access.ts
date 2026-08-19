import type { BetaAccessStatus, CompanyAccess } from "./domain";

export interface PlatformGrant {
  productType: "beauty" | "barber";
  accessType: "administrator" | "courtesy" | "beta_tester";
  status: "pending" | "active" | "suspended" | "revoked" | "expired";
  startsAt: string;
  expiresAt: string | null;
}

/**
 * Beta fechado: autenticar não é autorizar. Sem concessão da administradora o acesso
 * fica pendente; concessões suspensas, revogadas ou vencidas nunca liberam o painel.
 */
export function resolveBetaAccess(
  grants: readonly PlatformGrant[],
  productType: "beauty" | "barber",
  now = Date.now(),
): { status: BetaAccessStatus; accessType: CompanyAccess["betaAccessType"] } {
  const productGrants = grants.filter((grant) => grant.productType === productType);
  if (!productGrants.length) return { status: "pending", accessType: null };

  const active = productGrants.find(
    (grant) =>
      grant.status === "active" &&
      new Date(grant.startsAt).getTime() <= now &&
      (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now),
  );
  if (active) return { status: "approved", accessType: active.accessType };

  const grant = productGrants[0]!;
  if (grant.status === "active") {
    const expired = Boolean(grant.expiresAt && new Date(grant.expiresAt).getTime() <= now);
    return { status: expired ? "expired" : "pending", accessType: null };
  }
  return { status: grant.status, accessType: null };
}
