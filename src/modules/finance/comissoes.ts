/**
 * Domínio compartilhado das movimentações financeiras do profissional
 * (comissões, vales/adiantamentos, pagamentos e ajustes auditados).
 *
 * O histórico é imutável por regra de negócio: correções entram como
 * "adjustment" — nunca por exclusão de linha.
 */
export const ledgerKinds = ["commission", "advance", "payment", "adjustment"] as const;

export type LedgerKind = (typeof ledgerKinds)[number];

export const ledgerKindLabels: Record<LedgerKind, string> = {
  commission: "Comissão",
  advance: "Vale / adiantamento",
  payment: "Pagamento realizado",
  adjustment: "Ajuste",
};

export const ledgerKindHelp: Record<LedgerKind, string> = {
  commission: "Valor gerado por atendimentos concluídos.",
  advance: "Valor adiantado ao profissional, descontado do saldo.",
  payment: "Repasse já pago ao profissional.",
  adjustment: "Correção auditada (positiva ou negativa).",
};

export type LedgerEntry = {
  id: string;
  kind: LedgerKind;
  amountCents: number;
  competenceDate: string;
  description: string;
  notes: string | null;
  createdAt: string;
  appointmentId: string | null;
  professionalId: string;
  professionalName?: string | null;
};

export type LedgerSummary = {
  commissionCents: number;
  advanceCents: number;
  paymentCents: number;
  adjustmentCents: number;
  /** Saldo a receber: comissões + ajustes − vales − pagamentos. */
  balanceCents: number;
};

export function isLedgerKind(value: string): value is LedgerKind {
  return (ledgerKinds as readonly string[]).includes(value);
}

export function summarizeLedger(entries: readonly LedgerEntry[]): LedgerSummary {
  const total = (kind: LedgerKind) =>
    entries.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + entry.amountCents, 0);
  const commissionCents = total("commission");
  const advanceCents = total("advance");
  const paymentCents = total("payment");
  const adjustmentCents = total("adjustment");
  return {
    commissionCents,
    advanceCents,
    paymentCents,
    adjustmentCents,
    balanceCents: commissionCents + adjustmentCents - advanceCents - paymentCents,
  };
}

/** Competência no formato AAAA-MM. */
export function competenceMonth(entry: LedgerEntry): string {
  return entry.competenceDate.slice(0, 7);
}

export function monthLabel(month: string): string {
  const [year, monthPart] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (monthPart ?? 1) - 1, 1));
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    date,
  );
}

export function dateLabel(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)),
  );
}
