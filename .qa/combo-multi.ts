const url = "https://vctmjgezsdfwblemrjav.supabase.co";
const key = process.env.PROD_SUPABASE_SECRET_KEY!;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" };
const TENANT = "4071a52f-66ad-4253-8a48-bf5c1768e02d";
const SLUG = "top-barbers-277e3e0c";
const created: { table: string; id: string }[] = [];
let pass = 0, fail = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, JSON.stringify(extra)); }
}
async function req(method: string, path: string, body?: unknown) {
  const r = await fetch(`${url}/rest/v1/${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let json: any = null; try { json = JSON.parse(text); } catch {}
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0,400)}`);
  return json;
}
const ins = async (table: string, row: unknown) => {
  const [r] = await req("POST", table, row);
  created.push({ table, id: r.id });
  return r;
};
const rpc = async (fn: string, args: unknown) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(args) });
  const t = await r.text();
  if (!r.ok) throw new Error(`rpc ${fn} -> ${r.status} ${t.slice(0,500)}`);
  return JSON.parse(t);
};

try {
  const stamp = Date.now().toString().slice(-6);
  const profA = await ins("professionals", { tenant_id: TENANT, name: `QA Alfa ${stamp}`, active: true, commission_percent: 50 });
  const profB = await ins("professionals", { tenant_id: TENANT, name: `QA Beta ${stamp}`, active: true, commission_percent: 40 });
  const svc1 = await ins("services", { tenant_id: TENANT, name: `QA Corte ${stamp}`, duration_minutes: 30, price_cents: 5000, active: true, category: "QA" });
  const svc2 = await ins("services", { tenant_id: TENANT, name: `QA Barba ${stamp}`, duration_minutes: 30, price_cents: 3000, active: true, category: "QA" });
  const combo = await ins("services", { tenant_id: TENANT, name: `QA Combo ${stamp}`, duration_minutes: 60, price_cents: 7000, active: true, category: "QA", is_combo: true });
  await req("POST", "professional_services", [
    { tenant_id: TENANT, professional_id: profA.id, service_id: svc1.id },
    { tenant_id: TENANT, professional_id: profB.id, service_id: svc2.id },
  ]);
  await ins("service_combo_items", { tenant_id: TENANT, combo_service_id: combo.id, service_id: svc1.id, position: 0, assigned_professional_id: profA.id, execution_mode: "sequential" });
  await ins("service_combo_items", { tenant_id: TENANT, combo_service_id: combo.id, service_id: svc2.id, position: 1, assigned_professional_id: profB.id, execution_mode: "sequential" });

  // 1) plano de execução
  const plan = await rpc("booking_blocks_plan", { p_tenant_id: TENANT, p_service_ids: [combo.id], p_professional_id: null });
  check("plano com 2 blocos", plan.length === 2, plan);
  check("blocos em profissionais distintos", new Set(plan.map((b: any) => b.professional_id)).size === 2, plan);
  check("preço do combo rateado = 7000", plan.reduce((s: number, b: any) => s + b.price_cents, 0) === 7000, plan);
  check("offsets 0 e 30", plan.map((b: any) => b.offset_minutes).sort((a:number,b:number)=>a-b).join(",") === "0,30", plan);

  // 2) disponibilidade
  const tz = "America/Fortaleza";
  function localDate(offsetDays: number) {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  }
  let date = "", avail: any = null;
  for (let i = 2; i < 9; i++) {
    date = localDate(i);
    avail = await rpc("get_public_booking_availability_v3", { p_slug: SLUG, p_date: date, p_service_ids: [combo.id], p_professional_id: null });
    if (avail.slots?.length) break;
  }
  check("disponibilidade retorna horários", (avail.slots?.length ?? 0) > 0, avail);
  const slot = avail.slots[Math.floor(avail.slots.length / 2)];
  check("slot traz os 2 profissionais", slot.professionals?.length === 2, slot);
  check("slot dura 60 min", (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / 60000 === 60, slot);

  // 3) criação da reserva
  const booking = await rpc("create_public_booking_v4", {
    p_slug: SLUG, p_service_ids: [combo.id], p_professional_id: null, p_starts_at: slot.startsAt,
    p_customer_name: `QA Cliente ${stamp}`, p_customer_phone: "85999990000", p_request_id: crypto.randomUUID(),
    p_fingerprint: `qa-${stamp}`, p_payment_method: "local", p_payment_option: "full", p_honeypot: "",
  });
  check("reserva criada", booking.ok === true, booking);
  check("valor único do pedido = 7000", booking.totalPriceCents === 7000, booking);
  check("dois profissionais no resumo", (booking.professional ?? "").includes("+"), booking.professional);

  const appts = await req("GET", `appointments?booking_group_id=eq.${booking.bookingGroupId}&select=*&order=starts_at`);
  for (const a of appts) created.push({ table: "appointments", id: a.id });
  check("2 blocos gravados na agenda", appts.length === 2, appts.map((a:any)=>[a.professional_id,a.starts_at,a.ends_at]));
  check("soma dos blocos = total do pedido", appts.reduce((s: number, a: any) => s + a.price_cents, 0) === 7000, appts.map((a:any)=>a.price_cents));
  check("cada bloco de 30 min", appts.every((a: any) => (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime())/60000 === 30), appts);
  check("bloco 1 = Alfa, bloco 2 = Beta", appts[0].professional_id === profA.id && appts[1].professional_id === profB.id, appts.map((a:any)=>a.professional_id));
  const pays = await req("GET", `appointment_payments?appointment_id=eq.${booking.appointmentId}&select=*`);
  check("cobrança única do pedido", pays.length === 1 && pays[0].total_cents === 7000, pays);

  // 4) bloqueio correto de cada agenda
  const after = await rpc("get_public_booking_availability_v3", { p_slug: SLUG, p_date: date, p_service_ids: [combo.id], p_professional_id: null });
  const labels = after.slots.map((s: any) => s.label);
  check("horário reservado saiu da lista", !labels.includes(slot.label), { slot: slot.label, labels });
  // Alfa livre no 2º meia-hora (só Beta ocupado lá): serviço simples do Alfa deve continuar
  // disponível no horário em que Beta atende.
  const soloAlfa = await rpc("get_public_booking_availability_v3", { p_slug: SLUG, p_date: date, p_service_ids: [svc1.id], p_professional_id: profA.id });
  const alfaLabels = soloAlfa.slots.map((s: any) => s.label);
  const beta2nd = new Date(new Date(slot.startsAt).getTime() + 30 * 60000);
  const betaLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(beta2nd);
  check("agenda do Alfa livre enquanto Beta atende", alfaLabels.includes(betaLabel), { betaLabel, alfaLabels });
  check("agenda do Alfa bloqueada no seu próprio bloco", !alfaLabels.includes(slot.label), { slot: slot.label, alfaLabels });
  const soloBeta = await rpc("get_public_booking_availability_v3", { p_slug: SLUG, p_date: date, p_service_ids: [svc2.id], p_professional_id: profB.id });
  const betaLabels = soloBeta.slots.map((s: any) => s.label);
  check("agenda do Beta livre no bloco do Alfa", betaLabels.includes(slot.label), { slot: slot.label, betaLabels });
  check("agenda do Beta bloqueada no seu próprio bloco", !betaLabels.includes(betaLabel), { betaLabel, betaLabels });

  // 5) comissão por profissional
  const tenantRow = (await req("GET", `tenants?id=eq.${TENANT}&select=commission_trigger`))[0];
  await req("PATCH", `tenants?id=eq.${TENANT}`, { commission_trigger: "completed" });
  const { syncAppointmentFinancials } = await import("../src/modules/finance/comissoes.server");
  for (const a of appts) {
    await req("PATCH", `appointments?id=eq.${a.id}`, { status: "completed" });
    await syncAppointmentFinancials({ tenantId: TENANT, appointmentId: a.id });
  }
  const ledger = await req("GET", `professional_ledger_entries?tenant_id=eq.${TENANT}&appointment_id=in.(${appts.map((a:any)=>a.id).join(",")})&select=*`);
  for (const l of ledger) created.push({ table: "professional_ledger_entries", id: l.id });
  const byProf = Object.fromEntries(ledger.map((l: any) => [l.professional_id, l.amount_cents]));
  check("comissão gerada para os 2 profissionais", ledger.length === 2, ledger);
  check("comissão Alfa = 50% do bloco rateado", byProf[profA.id] === Math.round(appts[0].price_cents * 0.5), { byProf, bloco: appts[0].price_cents });
  check("comissão Beta = 40% do bloco rateado", byProf[profB.id] === Math.round(appts[1].price_cents * 0.4), { byProf, bloco: appts[1].price_cents });
  console.log("ledger detalhado", JSON.stringify(ledger.map((l:any)=>({p:l.professional_id===profA.id?"alfa":"beta",amount:l.amount_cents,kind:l.kind}))));
  console.log("blocos preço", JSON.stringify(appts.map((a:any)=>a.price_cents)));
  await req("PATCH", `tenants?id=eq.${TENANT}`, { commission_trigger: tenantRow.commission_trigger });
} catch (error) {
  fail++;
  console.log("ERRO", (error as Error).message);
} finally {
  // limpeza
  const ids = (t: string) => created.filter((c) => c.table === t).map((c) => c.id);
  const appt = ids("appointments");
  if (appt.length) {
    for (const t of ["professional_ledger_entries", "financial_entries", "appointment_payments", "notification_outbox", "appointment_services"]) {
      await fetch(`${url}/rest/v1/${t}?appointment_id=in.(${appt.join(",")})`, { method: "DELETE", headers: h });
    }
    await fetch(`${url}/rest/v1/appointments?id=in.(${appt.join(",")})`, { method: "DELETE", headers: h });
  }
  for (const t of ["service_combo_items", "services", "professionals"]) {
    const list = ids(t);
    if (list.length) {
      if (t === "professionals") await fetch(`${url}/rest/v1/professional_services?professional_id=in.(${list.join(",")})`, { method: "DELETE", headers: h });
      const r = await fetch(`${url}/rest/v1/${t}?id=in.(${list.join(",")})`, { method: "DELETE", headers: h });
      if (!r.ok) console.log("limpeza pendente", t, await r.text());
    }
  }
  await fetch(`${url}/rest/v1/clients?tenant_id=eq.${TENANT}&name=like.QA Cliente*`, { method: "DELETE", headers: h });
  console.log(`\nRESULTADO ${pass} PASS / ${fail} FAIL`);
}
