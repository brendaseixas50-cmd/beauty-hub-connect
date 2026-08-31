const url = "https://vctmjgezsdfwblemrjav.supabase.co";
const key = process.env.PROD_SUPABASE_SECRET_KEY!;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const g = async (p: string) => await (await fetch(`${url}/rest/v1/${p}`, { headers: h })).json();
const del = async (p: string) =>
  (await fetch(`${url}/rest/v1/${p}`, { method: "DELETE", headers: h })).status;
const patch = async (p: string, b: unknown) =>
  (await fetch(`${url}/rest/v1/${p}`, { method: "PATCH", headers: h, body: JSON.stringify(b) }))
    .status;
const rpc = async (fn: string, a: unknown) =>
  await (
    await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(a) })
  ).json();

const T = "4071a52f-66ad-4253-8a48-bf5c1768e02d";
const slug = "top-barbers-277e3e0c";
const CORTE = "69929979-6021-4f45-8dc5-61c7744f5070";
const UNHA = "65013890-aa37-413e-b29d-3be2274a47e6";
const ANTHONY = "49c2cc4a-0ebe-443e-ba0e-1a5a0b831517";
const JOAQUIM = "0bf6a3a5-aa6d-484e-9927-00a9df2a6a03";
const BRUNA = "d2ec7937-45b4-44d5-b4ee-f5372f2d1c3d";
const LINK = `service_addon_links?parent_service_id=eq.${CORTE}&addon_service_id=eq.${UNHA}`;

let ok = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) ok++;
  else fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${extra ? " :: " + extra : ""}`);
};
const groups: string[] = [];
const day = "2026-09-04";

async function plan(mode: string, chosen: Record<string, string> = {}, at = `${day}T13:00:00Z`) {
  return await rpc("booking_blocks_plan_v2", {
    p_tenant_id: T,
    p_service_ids: [CORTE, UNHA],
    p_professional_id: ANTHONY,
    p_addon_professionals: chosen,
    p_starts_at: at,
  });
}

// 1) modo any: adicional vai para quem é apto (Bruna)
await patch(LINK, { professional_mode: "any", preferred_fallback: "any", assigned_professional_id: null });
let p = await plan("any");
check("any: 2 blocos", Array.isArray(p) && p.length === 2, JSON.stringify(p));
check("any: adicional com Bruna", p?.[1]?.professional_id === BRUNA);
check("any: principal com Anthony", p?.[0]?.professional_id === ANTHONY);

// 2) preferencial existente
await patch(LINK, { professional_mode: "preferred", assigned_professional_id: BRUNA, preferred_fallback: "any" });
p = await plan("preferred");
check("preferred: adicional com o preferencial", p?.[1]?.professional_id === BRUNA, JSON.stringify(p));

// 3) preferencial inapto + fallback none -> nenhum plano
await patch(LINK, { professional_mode: "preferred", assigned_professional_id: JOAQUIM, preferred_fallback: "none" });
p = await plan("preferred-none");
check("preferred/none com inapto: sem plano", Array.isArray(p) && p.length === 0, JSON.stringify(p));

// 4) preferencial inapto + fallback any -> cai para apto
await patch(LINK, { professional_mode: "preferred", assigned_professional_id: JOAQUIM, preferred_fallback: "any" });
p = await plan("preferred-any");
check("preferred/any com inapto: usa apto", p?.[1]?.professional_id === BRUNA, JSON.stringify(p));

// 5) cliente escolhe
await patch(LINK, { professional_mode: "client_choice", assigned_professional_id: null, preferred_fallback: "any" });
p = await plan("client", { [UNHA]: BRUNA });
check("client_choice: respeita a escolha", p?.[1]?.professional_id === BRUNA, JSON.stringify(p));
p = await plan("client", { [UNHA]: JOAQUIM });
check("client_choice: rejeita escolha inapta", Array.isArray(p) && p.length === 0, JSON.stringify(p));

// volta ao modo padrão
await patch(LINK, { professional_mode: "any", assigned_professional_id: null, preferred_fallback: "any" });

// 6) reserva completa: código único, blocos separados, resumo com as 2 linhas
const av = await rpc("get_public_booking_availability_v4", {
  p_slug: slug,
  p_date: day,
  p_service_ids: [CORTE, UNHA],
  p_professional_id: ANTHONY,
  p_addon_professionals: {},
});
check("disponibilidade v4 devolve horários", (av?.slots?.length ?? 0) > 0);
const start = av?.slots?.[0]?.startsAt;
const booking = await rpc("create_public_booking_v5", {
  p_slug: slug,
  p_service_ids: [CORTE, UNHA],
  p_professional_id: ANTHONY,
  p_starts_at: start,
  p_customer_name: "QA Adicionais",
  p_customer_phone: "85999990002",
  p_request_id: crypto.randomUUID(),
  p_fingerprint: `qa-${crypto.randomUUID()}`,
  p_payment_method: "local",
  p_payment_option: "full",
  p_honeypot: "",
  p_addon_professionals: {},
});
check("reserva criada", booking?.ok === true, JSON.stringify(booking).slice(0, 200));
if (booking?.booking_group_id ?? booking?.bookingGroupId) groups.push(booking.bookingGroupId);
check("resumo lista os 2 executores", (booking?.assignments?.length ?? 0) === 2, JSON.stringify(booking?.assignments));
const rows = await g(
  `appointments?booking_group_id=eq.${booking?.bookingGroupId}&select=professional_id,service_id,starts_at,price_cents&order=starts_at`,
);
check("2 blocos gravados", rows?.length === 2, JSON.stringify(rows));
check("blocos em profissionais distintos", rows?.[0]?.professional_id !== rows?.[1]?.professional_id);
const soma = (rows ?? []).reduce((s: number, r: any) => s + r.price_cents, 0);
check("soma dos blocos = total do pedido", soma === booking?.totalPriceCents, `${soma} vs ${booking?.totalPriceCents}`);
const pays = await g(`appointment_payments?appointment_id=eq.${booking?.appointmentId}&select=amount_cents`);
check("cobrança única", pays?.length === 1, JSON.stringify(pays));

// 7) Anthony continua ocupado, Bruna livre no bloco do corte
const free = await rpc("professional_is_free", {
  p_tenant_id: T,
  p_professional_id: ANTHONY,
  p_starts_at: start,
  p_ends_at: new Date(new Date(start).getTime() + 30 * 60000).toISOString(),
});
check("agenda do principal fica ocupada", free === false, String(free));

// 8) regressão: serviço simples
const simples = await rpc("create_public_booking_v5", {
  p_slug: slug,
  p_service_ids: [CORTE],
  p_professional_id: JOAQUIM,
  p_starts_at: start,
  p_customer_name: "QA Simples",
  p_customer_phone: "85999990003",
  p_request_id: crypto.randomUUID(),
  p_fingerprint: `qa-${crypto.randomUUID()}`,
  p_payment_method: "local",
  p_payment_option: "full",
  p_honeypot: "",
  p_addon_professionals: {},
});
check("serviço simples continua funcionando", simples?.ok === true, JSON.stringify(simples).slice(0, 160));
if (simples?.bookingGroupId) groups.push(simples.bookingGroupId);
const simpleRows = await g(
  `appointments?public_code=eq.${simples?.code}&select=id,booking_group_id,professional_id`,
);
check("serviço simples gera 1 bloco", simpleRows?.length === 1, JSON.stringify(simpleRows));

// limpeza
const created = await g(
  `appointments?or=(public_code.eq.${booking?.code},public_code.eq.${simples?.code})&select=booking_group_id`,
);
const allGroups = new Set([
  ...groups,
  ...(created ?? []).map((r: any) => r.booking_group_id).filter(Boolean),
  "5acd3897-5a98-433a-86f8-ddfe93a78e7b",
]);
for (const gid of allGroups) {
  const ids = (await g(`appointments?booking_group_id=eq.${gid}&select=id`)).map((r: any) => r.id);
  for (const id of ids) {
    await del(`financial_entries?appointment_id=eq.${id}`);
    await del(`notification_outbox?appointment_id=eq.${id}`);
    await del(`appointment_payments?appointment_id=eq.${id}`);
    await del(`appointment_services?appointment_id=eq.${id}`);
    await del(`professional_ledger_entries?appointment_id=eq.${id}`);
    await del(`appointments?id=eq.${id}`);
  }
}
await del(`clients?tenant_id=eq.${T}&name=like.QA %`);
const leftovers = await g(`appointments?tenant_id=eq.${T}&starts_at=gte.${day}&select=id,public_code`);
console.log("restantes no dia de teste:", JSON.stringify(leftovers));
console.log(`\nRESULTADO: ${ok} PASS / ${fail} FAIL`);
