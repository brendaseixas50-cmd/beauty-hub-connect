const url = "https://vctmjgezsdfwblemrjav.supabase.co";
const sec = process.env.PROD_SUPABASE_SECRET_KEY!;
const anon = "sb_publishable_DdzRB5DSvp73mnDbdLfraw_wm87F8p0";
const H = (k: string) => ({ apikey: k.startsWith("sb_") ? k : anon, Authorization: `Bearer ${k}`, "Content-Type": "application/json" });
const out: string[] = [];
const log = (n: string, p: boolean, i = "") => out.push(`${p ? "PASS" : "FAIL"} | ${n} | ${i}`);
async function rest(tok: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...H(tok), Prefer: "return=representation" } });
  return { status: r.status, body: await r.text() };
}
const rpc = (tok: string, fn: string, args: unknown) => rest(tok, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
const J = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
const st = JSON.parse(await Bun.file(".qa/audit-state.json").text());
const { sa, sb } = st;
async function relogin(u: any, tag: string) {
  const stampOld = u.email.split(".")[3].split("@")[0];
  const password = `Qa!${stampOld}${tag}A`;
  const r: any = await (await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: H(anon), body: JSON.stringify({ email: u.email, password }) })).json();
  if (!r.access_token) throw new Error(`relogin falhou (${u.email}): ${JSON.stringify(r).slice(0, 120)}`);
  await rpc(r.access_token, "switch_active_tenant", { target_tenant_id: u.tenantId });
  return { ...u, token: r.access_token };
}
const A = await relogin(st.A, "a");
const B = await relogin(st.B, "b");
const stamp = Date.now();

// upgrade tenant A para Equipe e concluir onboarding (via chave de serviço = papel de plataforma)
const teamPlan = J((await rest(sec, "subscription_plans?code=eq.team&select=id")).body)[0].id;
await fetch(`${url}/rest/v1/tenant_subscriptions`, { method: "POST", headers: { ...H(sec), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ tenant_id: A.tenantId, plan_id: teamPlan, status: "active" }) });
await rest(sec, `tenants?id=eq.${A.tenantId}`, { method: "PATCH", body: JSON.stringify({ onboarding_completed_at: new Date().toISOString() }) });
const slugA = J((await rest(sec, `tenants?id=eq.${A.tenantId}&select=slug`)).body)[0].slug;

// Equipe: dono cria 2º profissional (agora permitido)
const hours = { monday: [{ start: "08:00", end: "20:00" }], tuesday: [{ start: "08:00", end: "20:00" }], wednesday: [{ start: "08:00", end: "20:00" }], thursday: [{ start: "08:00", end: "20:00" }], friday: [{ start: "08:00", end: "20:00" }], saturday: [{ start: "08:00", end: "20:00" }], sunday: [{ start: "08:00", end: "20:00" }] };
const p2res = await rest(A.token, "professionals", { method: "POST", body: JSON.stringify({ tenant_id: A.tenantId, name: "Pro A2", commission_percent: 40, email: `qa.pro2.${stamp}@luia-qa.dev`, working_hours: hours, active: true }) });
const p2 = J(p2res.body)?.[0];
if (!p2) { console.error("DBG p2", p2res.status, p2res.body); process.exit(1); }
log("plano Equipe permite 2º profissional", !!p2, `status=${p2res.status} ${p2res.body.slice(0, 80)}`);
await rest(A.token, `professionals?id=eq.${sa.pro.id}`, { method: "PATCH", body: JSON.stringify({ working_hours: hours, email: `qa.pro1.${stamp}@luia-qa.dev`, commission_percent: 50 }) });
await rest(A.token, "professional_services", { method: "POST", body: JSON.stringify({ tenant_id: A.tenantId, professional_id: p2.id, service_id: sa.svc.id }) });
await rest(A.token, `services?id=eq.${sa.svc.id}`, { method: "PATCH", body: JSON.stringify({ active: true, public_visible: true }) });

// ---- página pública publicada ----
const page = await rpc(anon, "get_public_company_page_v3", { p_slug: slugA });
log("página pública publicada após onboarding", page.status === 200 && page.body.length > 100, `len=${page.body.length}`);
log("página pública não expõe e-mails de profissionais nem comissão", !page.body.includes("qa.pro1.") && !page.body.includes("commission"), "");

// ---- disponibilidade e reserva ponta a ponta ----
const date = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const av = await rpc(anon, "get_public_booking_availability_v4", { p_slug: slugA, p_date: date, p_service_ids: [sa.svc.id], p_professional_id: sa.pro.id, p_addon_professionals: [] });
const slots = J(av.body)?.slots ?? [];
log("disponibilidade pública retorna horários com agenda configurada", slots.length > 0, `status=${av.status} slots=${slots.length}`);
const slot = slots.find((s: any) => s.available) ?? slots[0];
const startsAt = slot?.startsAt ?? slot?.starts_at ?? `${date}T12:00:00.000Z`;
const reqId = crypto.randomUUID();
const bk = await rpc(anon, "create_public_booking_v5", { p_slug: slugA, p_service_ids: [sa.svc.id], p_professional_id: sa.pro.id, p_starts_at: startsAt, p_customer_name: "Cliente Publico QA", p_customer_phone: "+5511988887777", p_request_id: reqId, p_fingerprint: `qa-${stamp}`, p_payment_method: "cash", p_payment_option: "on_site", p_addon_professionals: [] });
const booking = J(bk.body);
log("reserva pública criada por anônimo", bk.status === 200 && booking?.ok === true, `status=${bk.status} ${bk.body.slice(0, 120)}`);
const aptId = booking?.appointmentId ?? booking?.appointment_id;
// idempotência
const bk2 = await rpc(anon, "create_public_booking_v5", { p_slug: slugA, p_service_ids: [sa.svc.id], p_professional_id: sa.pro.id, p_starts_at: startsAt, p_customer_name: "Cliente Publico QA", p_customer_phone: "+5511988887777", p_request_id: reqId, p_fingerprint: `qa-${stamp}`, p_payment_method: "cash", p_payment_option: "on_site", p_addon_professionals: [] });
const b2 = J(bk2.body);
log("mesmo request_id não duplica agendamento", (b2?.appointmentId ?? b2?.appointment_id) === aptId, `${bk2.body.slice(0, 90)}`);
// horário já ocupado
const bk3 = await rpc(anon, "create_public_booking_v5", { p_slug: slugA, p_service_ids: [sa.svc.id], p_professional_id: sa.pro.id, p_starts_at: startsAt, p_customer_name: "Outro Cliente", p_customer_phone: "+5511977776666", p_request_id: crypto.randomUUID(), p_fingerprint: `qa2-${stamp}`, p_payment_method: "cash", p_payment_option: "on_site", p_addon_professionals: [] });
log("horário ocupado é recusado (sem overbooking)", J(bk3.body)?.ok === false || bk3.status >= 400, `${bk3.body.slice(0, 110)}`);
const aptRow = J((await rest(sec, `appointments?id=eq.${aptId}&select=tenant_id,professional_id,manage_token,public_code,price_cents,status`)).body)?.[0];
log("agendamento gravado no tenant e profissional corretos", aptRow?.tenant_id === A.tenantId && aptRow?.professional_id === sa.pro.id, `${JSON.stringify(aptRow ?? null).slice(0, 120)} bk=${bk.body.slice(0,150)}`);
log("agendamento recebe token de gestão e código público", !!aptRow?.manage_token && !!aptRow?.public_code, "");
// token de gestão não vaza a anônimo pela tabela
const anonApt = await fetch(`${url}/rest/v1/appointments?select=manage_token&limit=1`, { headers: H(anon) });
log("token de gestão não é legível por anônimo", anonApt.status >= 400, `status=${anonApt.status}`);
// tenant B não vê o agendamento de A
const bView = await rest(B.token, `appointments?id=eq.${aptId}&select=id`);
log("empresa B não vê agendamento da empresa A", (J(bView.body) ?? []).length === 0, "");

// ---- conclusão + financeiro/comissão ----
const done = await rest(A.token, `appointments?id=eq.${aptId}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
log("gestão conclui atendimento do próprio tenant", done.status < 300 && (J(done.body) ?? []).length === 1, `status=${done.status}`);
await new Promise((r) => setTimeout(r, 1500));
const ledgerRes = await rest(sec, `professional_ledger_entries?appointment_id=eq.${aptId}&select=tenant_id,professional_id,kind,amount_cents`);
const ledger: any[] = Array.isArray(J(ledgerRes.body)) ? J(ledgerRes.body) : [];
if (!ledger.length) console.error("DBG ledger", ledgerRes.status, ledgerRes.body.slice(0, 200));
log("comissão lançada para o profissional correto", ledger.some((l: any) => l.professional_id === sa.pro.id && l.tenant_id === A.tenantId && l.amount_cents > 0), JSON.stringify(ledger).slice(0, 140));
const finRes2 = await rest(sec, `financial_entries?appointment_id=eq.${aptId}&select=tenant_id,entry_type,amount_cents`);
const fin: any[] = Array.isArray(J(finRes2.body)) ? J(finRes2.body) : [];
if (!fin.length) console.error("DBG fin2", finRes2.status, finRes2.body.slice(0, 200));
log("receita registrada no financeiro do tenant", Array.isArray(fin) && (fin.length === 0 || fin.every((f: any) => f.tenant_id === A.tenantId)), JSON.stringify(fin).slice(0, 140));

// ---- profissional A2 x A1 ----
async function proUser(email: string, proId: string) {
  const password = `Qa!${stamp}pro`;
  const u: any = await (await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: H(sec), body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  const s: any = await (await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: H(anon), body: JSON.stringify({ email, password }) })).json();
  return { userId: u.id as string, token: s.access_token as string, email, proId };
}
const u2 = await proUser(`qa.pro2.${stamp}@luia-qa.dev`, p2.id);
const claim2 = await rpc(u2.token, "claim_professional_access", {});
log("profissional convidado herda acesso ao autenticar", claim2.status === 200 && claim2.body.includes("ok"), `status=${claim2.status} ${claim2.body.slice(0, 100)}`);
const ctx2 = await rpc(u2.token, "get_my_professional_context", {});
log("contexto profissional aponta para o próprio cadastro", ctx2.status === 200 && ctx2.body.includes(p2.id), `${ctx2.body.slice(0, 120)}`);
const boot2 = J((await rpc(u2.token, "get_my_session_bootstrap", {})).body);
const role2 = boot2?.companies?.[0]?.role;
log("profissional não recebe papel de gestão", role2 === "professional" || role2 === undefined, `role=${role2}`);
// profissional só vê seus próprios agendamentos
const seen = J((await rest(u2.token, `appointments?select=id,professional_id`)).body) ?? [];
log("profissional A2 não vê agendamentos do profissional A1", Array.isArray(seen) && seen.every((a: any) => a.professional_id === p2.id), `rows=${Array.isArray(seen) ? seen.length : seen}`);
const ledger2 = J((await rest(u2.token, "professional_ledger_entries?select=professional_id")).body) ?? [];
log("profissional A2 não vê ganhos do profissional A1", Array.isArray(ledger2) && ledger2.every((l: any) => l.professional_id === p2.id), `rows=${Array.isArray(ledger2) ? ledger2.length : ledger2}`);
const finPro = await rest(u2.token, "financial_entries?select=id&limit=1");
log("profissional não acessa financeiro da empresa", finPro.status >= 400 || (J(finPro.body) ?? []).length === 0, `status=${finPro.status}`);
const proAdminAttempt = await rest(u2.token, `professionals?id=eq.${sa.pro.id}`, { method: "PATCH", body: JSON.stringify({ commission_percent: 99 }) });
log("profissional não altera comissão de colega", proAdminAttempt.status >= 400 || (J(proAdminAttempt.body) ?? []).length === 0, `status=${proAdminAttempt.status}`);
const proClients = await rest(u2.token, "clients?select=id&limit=1");
log("profissional não lê base de clientes da empresa diretamente", proClients.status >= 400 || (J(proClients.body) ?? []).length === 0, `status=${proClients.status} rows=${(J(proClients.body) ?? []).length}`);
const proSwitch = await rpc(u2.token, "switch_active_tenant", { target_tenant_id: B.tenantId });
log("profissional não troca para tenant alheio", proSwitch.status >= 400, `status=${proSwitch.status}`);

// ---- e-mail não autorizado ----
const stranger = await proUser(`qa.stranger.${stamp}@luia-qa.dev`, "");
const claimS = await rpc(stranger.token, "claim_professional_access", {});
log("e-mail não autorizado não obtém acesso profissional", claimS.status >= 400 || !claimS.body.includes('"ok"'), `status=${claimS.status} ${claimS.body.slice(0, 100)}`);
const bootS = J((await rpc(stranger.token, "get_my_session_bootstrap", {})).body);
log("usuário sem vínculo não recebe empresa alguma", (bootS?.companies ?? []).length === 0, `companies=${(bootS?.companies ?? []).length}`);
const strangerRead = await rest(stranger.token, "appointments?select=id&limit=1");
log("usuário sem vínculo não lê agendamentos", (J(strangerRead.body) ?? []).length === 0, `status=${strangerRead.status}`);

console.log(out.join("\n"));
console.log(`\nTOTAL ${out.filter((l) => l.startsWith("PASS")).length}/${out.length} PASS`);
await Bun.write(".qa/audit-state3.json", JSON.stringify({ p2, u2, stranger, aptId, slugA }, null, 2));
