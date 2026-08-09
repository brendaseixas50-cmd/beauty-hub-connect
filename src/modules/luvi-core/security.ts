import type {
  LuviAction,
  LuviContextSnapshot,
  LuviToolDefinition,
} from "@/modules/luvi-core/types";

export const luviSecurityPolicy = {
  requiresAuthenticatedUser: true,
  validatesTenantOnServer: true,
  trustsTenantFromBrowser: false,
  allowsDirectOpenAICallsFromBrowser: false,
  storesSecretsInConversation: false,
  maximumPrimarySuggestions: 1,
  maximumSecondarySuggestions: 2,
  futureRateLimits: { perMinuteByUser: 10, perMinuteByTenant: 60, timeoutMs: 15_000 },
} as const;

export function canExposeTool(tool: LuviToolDefinition, context: LuviContextSnapshot) {
  if (!tool.enabled || tool.permission === "BLOCKED") return false;
  if (tool.permission === "ADMIN") return context.permissions.includes("settings:manage");
  return Boolean(context.tenantId && context.userId);
}

export function requiresExplicitConfirmation(action: LuviAction) {
  return action.kind === "CONFIRM_REQUIRED" || action.permission === "WRITE_CONFIRM";
}
