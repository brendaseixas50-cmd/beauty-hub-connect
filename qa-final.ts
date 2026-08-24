/**
 * Validação final pré-lançamento (produção). Arquivo temporário de QA.
 * Executa fluxos reais: disponibilidade pública, agenda individual, serviços,
 * isolamento entre empresas/profissionais, planos e pagamento.
 */
import { rest, rpc, rpcPublic, signIn, PASSWORD, check, report } from "/tmp/qa/lib";
import {
  filterSlotsByProfessionalAgenda,
  publicBookingBlockReason,
} from "./src/modules/public-booking/disponibilidade.server";

type State = {
  stamp: string;
  master: { email: string };
  a: { slug: string; tenantId: string; ownerEmail: string; serviceId: string; inactiveServiceId: string };
  b: { slug: string; tenantId: string; ownerEmail: string; serviceId: string };
  solo: { slug: string; tenantId: string; ownerEmail: string; serviceId: string };
  a1: { id: string; email: string; userId: string };
  a2: { id: string; email: string; userId: string };
  b1: { id: string; email: string; userId: string };
  outsider: { email: string; userId: string };
};

const state: State = await Bun.file("/tmp/qa/state.json").json();

/** Próxima data (>= amanhã) com o dia da semana desejado, em America/Fortaleza (UTC-3). */
function nextWeekday(weekday: number): string {
  for (let offset = 1; offset < 15; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000 - 3 * 3_600_000);
    if (date.getUTCDay() === weekday) return date.toISOString().slice(0, 10);
  }
  throw new Error("data não encontrada");
}

const tuesday = nextWeekday(2);
const saturday = nextWeekday(6);
const sunday = nextWeekday(0);
const at = (date: string, time: string) => `${date}T${time}:00-03:00`;

async function availability(slug: string, date: string, serviceIds: string[], professionalId: string | null) {
  const response = await rpcPublic("get_public_booking_availability_v2", {
    p_slug: slug,
    p_date: date,
    p_service_ids: serviceIds,
    p_professional_id: professionalId,
  });
  const slots = (response.data?.slots ?? []) as {
    startsAt: string;
    endsAt: string;
    professionals: { id: string; name: string }[];
  }[];
  return { raw: slots, filtered: await filterSlotsByProfessionalAgenda(slug, slots) };
}

const localTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Fortaleza",
    hour: "2-digit",
    minute: "2-digit",
  });

const startsFor = (
  slots: { startsAt: string; professionals: { id: string }[] }[],
  professionalId: string,
) =>
  slots
    .filter((slot) => slot.professionals.some((professional) => professional.id === professionalId))
    .map((slot) => localTime(slot.startsAt));

console.log(`\n== Datas de teste: terça ${tuesday} | sábado ${saturday} | domingo ${sunday}\n`);

// ---------------------------------------------------------------- 1. Agenda
const tue = await availability(state.a.slug, tuesday, [state.a.serviceId], null);
const a1Starts = startsFor(tue.filtered, state.a1.id);
const a2Starts = startsFor(tue.filtered, state.a2.id);
check(
  "A1 respeita expediente 09:00-18:00 (serviço de 60min termina 18:00)",
  a1Starts[0] === "09:00" && a1Starts.at(-1) === "17:00",
  a1Starts.join(" "),
);
check(
  "A1 respeita intervalo 12:00-13:00 (sem 11:30/12:00/12:30)",
  !a1Starts.includes("12:00") && !a1Starts.includes("12:30") && !a1Starts.includes("11:30"),
  a1Starts.join(" "),
);
check(
  "A2 só oferece horários do próprio expediente (14:00-18:00)",
  a2Starts.length > 0 && a2Starts[0] === "14:00" && a2Starts.at(-1) === "17:00",
  a2Starts.join(" "),
);
check(
  "Agenda individual: horários da manhã existem só para A1",
  tue.filtered.some(
    (slot) =>
      localTime(slot.startsAt) === "09:00" &&
      slot.professionals.length === 1 &&
      slot.professionals[0]!.id === state.a1.id,
  ),
  `09:00 -> ${tue.filtered.find((slot) => localTime(slot.startsAt) === "09:00")?.professionals.length ?? 0} profissional(is)`,
);

const tueA2 = await availability(state.a.slug, tuesday, [state.a.serviceId], state.a2.id);
check(
  "Filtro por profissional escolhido devolve apenas a agenda dele",
  tueA2.filtered.every((slot) => slot.professionals.every((professional) => professional.id === state.a2.id)) &&
    startsFor(tueA2.filtered, state.a2.id)[0] === "14:00",
  startsFor(tueA2.filtered, state.a2.id).join(" "),
);

const sat = await availability(state.a.slug, saturday, [state.a.serviceId], null);
check("Folga semanal (sábado) zera os horários dos profissionais", sat.filtered.length === 0, `bruto=${sat.raw.length} filtrado=${sat.filtered.length}`);
const sun = await availability(state.a.slug, sunday, [state.a.serviceId], null);
check("Empresa fechada (domingo) não oferece horários", sun.filtered.length === 0, `filtrado=${sun.filtered.length}`);

// Bloqueio pontual (folga/compromisso) de A1 às 15:00
const block = await rest("professional_unavailability", {
  method: "POST",
  prefer: "return=representation",
  body: {
    tenant_id: state.a.tenantId,
    professional_id: state.a1.id,
    starts_at: at(tuesday, "15:00"),
    ends_at: at(tuesday, "16:00"),
    reason: "QA bloqueio",
    created_by: state.a1.userId,
  },
});
if (!block.ok) throw new Error(`bloqueio: ${block.text}`);
const afterBlock = await availability(state.a.slug, tuesday, [state.a.serviceId], null);
check(
  "Bloqueio pontual remove o horário apenas do profissional bloqueado",
  !startsFor(afterBlock.filtered, state.a1.id).includes("15:00") &&
    startsFor(afterBlock.filtered, state.a2.id).includes("15:00"),
  `A1=${startsFor(afterBlock.filtered, state.a1.id).join(" ")}`,
);

// ------------------------------------------------- 2. Regras de agendamento
check(
  "Agendamento no intervalo do profissional é recusado",
  (await publicBookingBlockReason({
    slug: state.a.slug,
    professionalId: state.a1.id,
    serviceIds: [state.a.serviceId],
    startsAt: at(tuesday, "12:00"),
  })) !== null,
);
check(
  "Agendamento fora do expediente do profissional é recusado (A2 às 09:00)",
  (await publicBookingBlockReason({
    slug: state.a.slug,
    professionalId: state.a2.id,
    serviceIds: [state.a.serviceId],
    startsAt: at(tuesday, "09:00"),
  })) !== null,
);
check(
  "Agendamento no bloqueio pontual é recusado",
  (await publicBookingBlockReason({
    slug: state.a.slug,
    professionalId: state.a1.id,
    serviceIds: [state.a.serviceId],
    startsAt: at(tuesday, "15:00"),
  })) !== null,
);
check(
  "Agendamento válido é liberado (A1 às 09:00)",
  (await publicBookingBlockReason({
    slug: state.a.slug,
    professionalId: state.a1.id,
    serviceIds: [state.a.serviceId],
    startsAt: at(tuesday, "09:00"),
  })) === null,
);
check(
  "Profissional de outra empresa é recusado na página pública",
  (await publicBookingBlockReason({
    slug: state.a.slug,
    professionalId: state.b1.id,
    serviceIds: [state.a.serviceId],
    startsAt: at(tuesday, "09:00"),
  })) !== null,
);
check(
  "Serviço de outra empresa é recusado na página pública",
  (await publicBookingBlockReason({
    slug: state.a.slug,
    professionalId: state.a1.id,
    serviceIds: [state.b.serviceId],
    startsAt: at(tuesday, "09:00"),
  })) !== null,
);
check(
  "Serviço inativo é recusado na página pública",
  (await publicBookingBlockReason({
    slug: state.a.slug,
    professionalId: state.a1.id,
    serviceIds: [state.a.inactiveServiceId],
    startsAt: at(tuesday, "10:00"),
  })) !== null,
);

// -------------------------------------------------- 3. Agendamento real
const booking = await rpcPublic("create_public_booking_v3", {
  p_slug: state.a.slug,
  p_service_ids: [state.a.serviceId],
  p_professional_id: state.a1.id,
  p_starts_at: at(tuesday, "10:00"),
  p_customer_name: "Cliente QA",
  p_customer_phone: "+5585999990001",
  p_request_id: crypto.randomUUID(),
  p_fingerprint: `qa-${state.stamp}-1`,
  p_payment_method: "local",
  p_payment_option: "full",
  p_honeypot: "",
});
check("Agendamento público é criado", booking.data?.ok === true, JSON.stringify(booking.data).slice(0, 200));
const appointmentId = booking.data?.appointmentId as string | undefined;
if (appointmentId) {
  const row = (await rest(`appointments?select=starts_at,ends_at,status,tenant_id,professional_id&id=eq.${appointmentId}`)).data[0];
  const minutes = (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60_000;
  check("Duração do serviço (60min) é aplicada ao agendamento", minutes === 60, `${minutes}min`);
  check("Agendamento fica na empresa e no profissional corretos", row.tenant_id === state.a.tenantId && row.professional_id === state.a1.id);
}
const conflict = await publicBookingBlockReason({
  slug: state.a.slug,
  professionalId: state.a1.id,
  serviceIds: [state.a.serviceId],
  startsAt: at(tuesday, "10:00"),
});
check("Horário já reservado não é oferecido novamente (sem overbooking)", conflict !== null, conflict ?? "");
const afterBooking = await availability(state.a.slug, tuesday, [state.a.serviceId], null);
check(
  "Disponibilidade pública deixa de mostrar o horário reservado de A1",
  !startsFor(afterBooking.filtered, state.a1.id).includes("10:00"),
  `A1=${startsFor(afterBooking.filtered, state.a1.id).join(" ")}`,
);

// -------------------------------------------------- 4. Página pública
const page = await rpcPublic("get_public_company_page_v3", { p_slug: state.a.slug });
const services = (page.data?.services ?? []) as { id: string; name: string }[];
check("Página pública publica a empresa", Boolean(page.data), page.data?.company?.name ?? "");
check(
  "Serviço inativo não aparece na página pública",
  services.some((service) => service.id === state.a.serviceId) &&
    !services.some((service) => service.id === state.a.inactiveServiceId),
  services.map((service) => service.name).join(", "),
);
const pageOther = await rpcPublic("get_public_company_page_v3", { p_slug: state.b.slug });
check(
  "Página pública de B não expõe dados de A",
  ((pageOther.data?.services ?? []) as { id: string }[]).every((service) => service.id !== state.a.serviceId),
);

// -------------------------------------------------- 5. Profissional x gestão
const a1Token = await signIn(state.a1.email, PASSWORD);
const a1Context = await rpc("get_my_professional_context", {}, a1Token);
check(
  "Herança de acesso: profissional autorizado entra sem liberação individual",
  a1Context.ok && Boolean(a1Context.data),
  JSON.stringify(a1Context.data).slice(0, 160),
);
const a1Access = await rpc("get_my_platform_access", {}, a1Token);
check(
  "Profissional não recebe liberação administrativa (sem acesso ao painel de gestão)",
  ((a1Access.data?.grants ?? []) as unknown[]).length === 0 && a1Access.data?.isAdministrator !== true,
  JSON.stringify(a1Access.data),
);
const a1Bootstrap = await rpc("get_my_session_bootstrap", {}, a1Token);
check(
  "Sessão do profissional tem papel 'professional' na empresa correta",
  ((a1Bootstrap.data?.companies ?? []) as { role: string; tenantId: string }[]).every(
    (company) => company.role === "professional" && company.tenantId === state.a.tenantId,
  ),
  JSON.stringify(a1Bootstrap.data?.companies),
);
const a1Team = await rest("professionals?select=id,name", { token: a1Token });
check(
  "Profissional só enxerga a própria ficha na equipe",
  a1Team.ok && a1Team.data.length === 1 && a1Team.data[0].id === state.a1.id,
  JSON.stringify(a1Team.data).slice(0, 160),
);
const a1Appointments = await rest("appointments?select=id,professional_id", { token: a1Token });
check(
  "Profissional só enxerga os próprios agendamentos",
  a1Appointments.ok && a1Appointments.data.every((row: { professional_id: string }) => row.professional_id === state.a1.id),
  `${a1Appointments.data?.length ?? 0} registro(s)`,
);
const a1Grants = await rest("platform_access_grants?select=email", { token: a1Token });
check(
  "Profissional não lê a tabela de liberações da plataforma",
  !a1Grants.ok || a1Grants.data.length === 0,
  `${a1Grants.status} ${JSON.stringify(a1Grants.data).slice(0, 80)}`,
);
const a1Admin = await rpc("admin_list_platform_access", {}, a1Token);
check("Profissional não acessa o Painel Master", !a1Admin.ok, `${a1Admin.status} ${a1Admin.text.slice(0, 80)}`);
const a1EditOther = await rest(`professionals?id=eq.${state.a2.id}`, {
  method: "PATCH",
  token: a1Token,
  prefer: "return=representation",
  body: { name: "Invadido" },
});
check(
  "Profissional não altera a ficha de outro profissional",
  !a1EditOther.ok || a1EditOther.data.length === 0,
  `${a1EditOther.status}`,
);
const a1Finance = await rest("financial_entries?select=id", { token: a1Token });
check(
  "Profissional não lê o financeiro da empresa",
  !a1Finance.ok || a1Finance.data.length === 0,
  `${a1Finance.status} ${JSON.stringify(a1Finance.data).slice(0, 60)}`,
);

// A1 x A2 (mesma empresa)
const a2Token = await signIn(state.a2.email, PASSWORD);
const a2Appointments = await rest("appointments?select=id,professional_id", { token: a2Token });
check(
  "Profissional A2 não vê agendamentos de A1",
  a2Appointments.ok && a2Appointments.data.every((row: { professional_id: string }) => row.professional_id === state.a2.id),
  `${a2Appointments.data?.length ?? 0} registro(s)`,
);

// Empresa A x Empresa B
const b1Token = await signIn(state.b1.email, PASSWORD);
const b1Services = await rest("services?select=id,tenant_id", { token: b1Token });
check(
  "Profissional de B não lê dados de A",
  b1Services.ok && b1Services.data.every((row: { tenant_id: string }) => row.tenant_id === state.b.tenantId),
  `${b1Services.data?.length ?? 0} serviço(s)`,
);
const ownerBToken = await signIn(state.b.ownerEmail, PASSWORD);
const ownerBClients = await rest("clients?select=id,tenant_id", { token: ownerBToken });
check(
  "Proprietário de B não lê clientes de A",
  ownerBClients.ok && ownerBClients.data.every((row: { tenant_id: string }) => row.tenant_id === state.b.tenantId),
  `${ownerBClients.data?.length ?? 0} cliente(s)`,
);
const ownerBSwitch = await rpc("switch_active_tenant", { target_tenant_id: state.a.tenantId }, ownerBToken);
const ownerBAfter = await rpc("get_my_session_bootstrap", {}, ownerBToken);
check(
  "Troca de empresa para uma empresa alheia é recusada",
  !ownerBSwitch.ok || ownerBAfter.data?.activeTenantId === state.b.tenantId,
  `${ownerBSwitch.status} ativo=${ownerBAfter.data?.activeTenantId === state.b.tenantId ? "B" : "A"}`,
);

// E-mail não autorizado e auto-convite
const outsiderToken = await signIn(state.outsider.email, PASSWORD);
const outsiderContext = await rpc("get_my_professional_context", {}, outsiderToken);
check(
  "E-mail não autorizado não obtém contexto de profissional",
  !outsiderContext.ok || !outsiderContext.data,
  JSON.stringify(outsiderContext.data).slice(0, 120),
);
const selfInvite = await rest("professionals", {
  method: "POST",
  token: outsiderToken,
  prefer: "return=representation",
  body: { tenant_id: state.a.tenantId, name: "Auto convite", email: state.outsider.email, active: true },
});
check("Auto-convite malicioso é bloqueado", !selfInvite.ok, `${selfInvite.status} ${selfInvite.text.slice(0, 90)}`);
const selfMembership = await rest("tenant_memberships", {
  method: "POST",
  token: outsiderToken,
  prefer: "return=representation",
  body: { user_id: state.outsider.userId, tenant_id: state.a.tenantId, role: "owner" },
});
check("Auto-vínculo em empresa alheia é bloqueado", !selfMembership.ok, `${selfMembership.status}`);
const claim = await rpc("claim_professional_access", {}, outsiderToken);
check(
  "claim_professional_access não libera e-mail não autorizado",
  !claim.ok || claim.data === null || claim.data === false || JSON.stringify(claim.data).includes("null"),
  `${claim.status} ${claim.text.slice(0, 90)}`,
);

// Desativação e remoção
await rest(`professionals?id=eq.${state.a1.id}`, { method: "PATCH", body: { active: false } });
const a1TokenOff = await signIn(state.a1.email, PASSWORD);
const contextOff = await rpc("get_my_professional_context", {}, a1TokenOff);
check(
  "Profissional desativado perde o acesso imediatamente",
  !contextOff.ok || !contextOff.data,
  JSON.stringify(contextOff.data).slice(0, 120),
);
await rest(`professionals?id=eq.${state.a1.id}`, { method: "PATCH", body: { active: true } });
const a1TokenBack = await signIn(state.a1.email, PASSWORD);
await rpc("switch_active_tenant", { target_tenant_id: state.a.tenantId }, a1TokenBack);
const contextBack = await rpc("get_my_professional_context", {}, a1TokenBack);
check("Reativação devolve o acesso do profissional", contextBack.ok && Boolean(contextBack.data));

// Empresa suspensa perde herança
const masterToken = await signIn(state.master.email, PASSWORD);
const suspend = await rpc(
  "admin_upsert_platform_access",
  {
    target_email: state.a.ownerEmail,
    target_product: "beauty",
    target_access_type: "beta_tester",
    target_status: "suspended",
    target_plan: "team",
  },
  masterToken,
);
const contextSuspended = await rpc("get_my_professional_context", {}, a1TokenBack);
check(
  "Empresa suspensa no Painel Master derruba o acesso herdado do profissional",
  suspend.ok && (!contextSuspended.ok || !contextSuspended.data),
  `${suspend.status} ${JSON.stringify(contextSuspended.data).slice(0, 90)}`,
);
await rpc(
  "admin_upsert_platform_access",
  {
    target_email: state.a.ownerEmail,
    target_product: "beauty",
    target_access_type: "beta_tester",
    target_status: "active",
    target_plan: "team",
  },
  masterToken,
);

// -------------------------------------------------- 6. Solo x Equipe
const soloOwnerToken = await signIn(state.solo.ownerEmail, PASSWORD);
const soloExtra = await rest("professionals", {
  method: "POST",
  token: soloOwnerToken,
  prefer: "return=representation",
  body: { tenant_id: state.solo.tenantId, name: "Solo extra", email: `qa-solo-extra-${state.stamp}@luiaqa.dev`, active: true },
});
check(
  "Plano Solo bloqueia o segundo profissional",
  !soloExtra.ok && soloExtra.text.includes("Limite"),
  `${soloExtra.status} ${soloExtra.text.slice(0, 90)}`,
);
await rpc(
  "admin_upsert_platform_access",
  {
    target_email: state.solo.ownerEmail,
    target_product: "beauty",
    target_access_type: "beta_tester",
    target_status: "active",
    target_plan: "team",
  },
  masterToken,
);
const soloUpgraded = await rest("professionals", {
  method: "POST",
  token: soloOwnerToken,
  prefer: "return=representation",
  body: { tenant_id: state.solo.tenantId, name: "Equipe liberada", email: `qa-team-ok-${state.stamp}@luiaqa.dev`, active: true },
});
check(
  "Upgrade para Equipe no Painel Master libera novos profissionais na hora",
  soloUpgraded.ok,
  `${soloUpgraded.status} ${soloUpgraded.text.slice(0, 90)}`,
);
const ownerAToken = await signIn(state.a.ownerEmail, PASSWORD);
const teamNinth: number[] = [];
for (let index = 0; index < 8; index += 1) {
  const created = await rest("professionals", {
    method: "POST",
    token: ownerAToken,
    prefer: "return=representation",
    body: { tenant_id: state.a.tenantId, name: `Equipe QA ${index}`, email: `qa-team-${index}-${state.stamp}@luiaqa.dev`, active: true },
  });
  teamNinth.push(created.status);
  if (!created.ok) break;
}
check(
  "Plano Equipe permite 8 profissionais e bloqueia o 9º",
  teamNinth.filter((status) => status === 201).length + 3 === 8 && teamNinth.at(-1) === 400,
  `respostas=${teamNinth.join(",")}`,
);

// -------------------------------------------------- 7. Pagamento (Mercado Pago)
const { createMercadoPagoCheckout } = await import("./src/modules/payments/mercado-pago.server");
let checkoutMessage = "";
try {
  await createMercadoPagoCheckout({
    slug: state.a.slug,
    entityType: "appointment",
    entityId: appointmentId!,
    amountCents: 10000,
    title: "QA",
    requestId: crypto.randomUUID(),
  });
  checkoutMessage = "checkout criado";
} catch (cause) {
  checkoutMessage = cause instanceof Error ? cause.message : String(cause);
}
check(
  "Mercado Pago sem conta conectada devolve mensagem clara (sem quebrar o agendamento)",
  checkoutMessage.length > 0 && !checkoutMessage.toLowerCase().includes("undefined"),
  checkoutMessage.slice(0, 140),
);
const webhook = await fetch("http://localhost:8080/api/public/mercado-pago/webhook", { method: "POST", body: "{}" });
check(
  "Webhook público do Mercado Pago responde sem exigir login (e rejeita payload inválido)",
  webhook.status !== 401 && webhook.status !== 404,
  `HTTP ${webhook.status}`,
);

report();
