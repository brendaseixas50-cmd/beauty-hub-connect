export type LuviProductId = "beauty" | "barber" | "default";
export type LuviPriority = "critical" | "high" | "medium" | "informative";
export type LuviActionKind =
  "NAVIGATE" | "FILTER" | "EXPLAIN" | "HIGHLIGHT" | "DRAFT" | "CONFIRM_REQUIRED";
export type LuviPermission = "READ" | "DRAFT" | "WRITE_CONFIRM" | "ADMIN" | "BLOCKED";
export type LuviRoute =
  | "/painel"
  | "/painel/agenda"
  | "/painel/clientes"
  | "/painel/servicos"
  | "/painel/profissionais"
  | "/painel/produtos"
  | "/painel/estoque"
  | "/painel/financeiro"
  | "/painel/empresa"
  | "/painel/configuracoes"
  | "/painel/pagina-publica";

export type LuviFacts = Partial<{
  appointmentsToday: number;
  pendingAppointments: number;
  clients: number;
  clientsMissingContact: number;
  services: number;
  inactiveServices: number;
  professionals: number;
  products: number;
  lowStock: number;
  stockMovements: number;
  financialEntries: number;
  publicPageMissingFields: number;
}>;

export interface LuviAction {
  id: string;
  label: string;
  kind: LuviActionKind;
  permission: LuviPermission;
  to?: LuviRoute;
  explanation?: string;
}

export interface LuviSuggestion {
  id: string;
  title: string;
  message: string;
  priority: LuviPriority;
  action?: LuviAction;
  dismissible: boolean;
}

export interface LuviContextSnapshot {
  product: LuviProductId;
  tenantId: string;
  userId: string;
  pathname: string;
  permissions: readonly string[];
  facts: LuviFacts;
}

export interface LuviTheme {
  product: LuviProductId;
  label: string;
  className: string;
  faceAsset: string;
  fullAsset: string;
  tone: "welcoming" | "confident";
}

export interface LuviProvider {
  readonly id: "guided" | "openai" | "unavailable";
  getSuggestions(context: LuviContextSnapshot): Promise<LuviSuggestion[]>;
}

export interface LuviToolDefinition {
  id: string;
  description: string;
  permission: LuviPermission;
  enabled: boolean;
}

export interface LuviHistoryItem {
  id: string;
  title: string;
  createdAt: string;
}
