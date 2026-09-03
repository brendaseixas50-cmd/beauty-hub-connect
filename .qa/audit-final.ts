const url = "https://vctmjgezsdfwblemrjav.supabase.co";
const sec = process.env.PROD_SUPABASE_SECRET_KEY!;
const anon = "sb_publishable_DdzRB5DSvp73mnDbdLfraw_wm87F8p0";
const H = (k: string) => ({ apikey: k.startsWith("sb_") ? k : anon, Authorization: `Bearer ${k}`, "Content-Type": "application/json" });
const SH = H(sec);
const out: string[] = [];
const log = (name: string, pass: boolean, info = "") => { out.push(`${pass ? "PASS" : "FAIL"} | ${name} | ${info}`); };

async function rest(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...H(token), Prefer: "return=representation" } });
  const t = await r.text();
  return { status: r.status, body: t };
}
async function rpc(token: string, fn: string, args: unknown) {
  return rest(token, `rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });
}

const stamp = Date.now();
async function mkUser(tag: string, product: string, company: string) {
  const email = `qa.audit.${tag}.${stamp}@luia-qa.dev`;
  const password = `Qa!${stamp}${tag}A`;
  const u: any = await (await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: SH, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  await fetch(`${url}/rest/v1/platform_access_grants`, { method: "POST", headers: SH, body: JSON.stringify({ email, user_id: u.id, product_type: product, access_type: "beta_tester", status: "active", plan_code: "team" }) });
  const s: any = await (await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: H(anon), body: JSON.stringify({ email, password }) })).json();
  const token = s.access_token as string;
  const created = await rpc(token, "create_company_for_current_user", { company_name: company, selected_product: product });
  const tenantId = JSON.parse(created.body) as string;
  await rpc(token, "switch_active_tenant", { target_tenant_id: tenantId });
  const boot = JSON.parse((await rpc(token, "get_my_session_bootstrap", {})).body);
  const mine = boot.companies.find((c: any) => c.tenantId === tenantId);
  if (!mine) throw new Error(`bootstrap sem tenant criado: ${created.body} / ${JSON.stringify(boot.companies)}`);
  return { email, userId: u.id as string, token, tenantId, role: mine.role };
}

const A = await mkUser("a", "beauty", `QA Empresa A ${stamp}`);
const B = await mkUser("b", "barber", `QA Empresa B ${stamp}`);
log("setup: dois tenants isolados criados", A.tenantId !== B.tenantId, `A=${A.tenantId.slice(0,8)} role=${A.role} B=${B.tenantId.slice(0,8)}`);

// seed em cada tenant com o próprio token (prova que escrita própria funciona)
async function seed(u: typeof A) {
  const cli = JSON.parse((await rest(u.token, "clients", { method: "POST", body: JSON.stringify({ tenant_id: u.tenantId, name: "Cliente QA", phone: "+5511999990000" }) })).body)[0];
  const svc = JSON.parse((await rest(u.token, "services", { method: "POST", body: JSON.stringify({ tenant_id: u.tenantId, name: "Servico QA", duration_minutes: 30, price_cents: 5000 }) })).body)[0];
  let pro = JSON.parse((await rest(u.token, `professionals?tenant_id=eq.${u.tenantId}&select=*&limit=1`)).body)[0];
  if (!pro) {
    const proRes = await rest(u.token, "professionals", { method: "POST", body: JSON.stringify({ tenant_id: u.tenantId, name: "Pro QA", commission_percent: 50 }) });
    pro = JSON.parse(proRes.body)[0];
    if (!pro) throw new Error(`seed professional: ${proRes.status} ${proRes.body}`);
  }
  const prod = JSON.parse((await rest(u.token, "products", { method: "POST", body: JSON.stringify({ tenant_id: u.tenantId, name: "Produto QA", cost_cents: 100, sale_price_cents: 200, stock_quantity: 5, minimum_stock: 1, unit: "un" }) })).body)[0];
  await rest(u.token, "professional_services", { method: "POST", body: JSON.stringify({ tenant_id: u.tenantId, professional_id: pro.id, service_id: svc.id }) });
  const start = new Date(Date.now() + 86400000).toISOString();
  const apt = JSON.parse((await rest(u.token, "appointments", { method: "POST", body: JSON.stringify({ tenant_id: u.tenantId, client_id: cli.id, service_id: svc.id, professional_id: pro.id, starts_at: start, ends_at: new Date(Date.now() + 86400000 + 1800000).toISOString(), price_cents: 5000, status: "scheduled" }) })).body)[0];
  const finRes = await rest(u.token, "financial_entries", { method: "POST", body: JSON.stringify({ tenant_id: u.tenantId, entry_type: "revenue", description: "QA", amount_cents: 5000, due_date: new Date().toISOString().slice(0, 10), status: "paid", origin: "manual" }) });
  const aptRes2 = apt ? null : null;
  if (!JSON.parse(finRes.body)[0]) console.error("DBG fin", finRes.status, finRes.body.slice(0, 250), "| apt:", JSON.stringify(apt).slice(0,120));
  const fin = JSON.parse(finRes.body)[0] ?? { id: null };
  return { cli, svc, pro, prod, apt, fin };
}
const sa = await seed(A); const sb = await seed(B);
// limite de plano Solo aplicado no banco (não só no frontend)
const extraPro = await rest(A.token, "professionals", { method: "POST", body: JSON.stringify({ tenant_id: A.tenantId, name: "Pro Extra", commission_percent: 10 }) });
log("limite de profissionais do plano aplicado no banco", extraPro.status >= 400, `status=${extraPro.status} ${extraPro.body.slice(0,70)}`);
log("escrita no próprio tenant funciona (A)", !!(sa.cli?.id && sa.apt?.id && sa.fin?.id), `apt=${sa.apt?.id?.slice(0,8)}`);
log("escrita no próprio tenant funciona (B)", !!(sb.cli?.id && sb.apt?.id && sb.fin?.id), "");

// === 1. leitura cruzada ===
const tables: [string, string][] = [["clients", sb.cli.id], ["services", sb.svc.id], ["professionals", sb.pro.id], ["products", sb.prod.id], ["appointments", sb.apt.id], ["financial_entries", sb.fin.id]];
for (const [t, id] of tables) {
  const r = await rest(A.token, `${t}?id=eq.${id}&select=*`);
  let rows: any = []; try { rows = JSON.parse(r.body); } catch { rows = r.body; }
  log(`leitura cruzada negada: ${t}`, Array.isArray(rows) && rows.length === 0, `status=${r.status} rows=${Array.isArray(rows) ? rows.length : r.body.slice(0, 60)}`);
}
const tb = await rest(A.token, `tenants?id=eq.${B.tenantId}&select=id,name,email,phone`);
log("leitura cruzada negada: tenants", JSON.parse(tb.body).length === 0, `status=${tb.status}`);
const mb = await rest(A.token, `tenant_memberships?tenant_id=eq.${B.tenantId}&select=*`);
log("leitura cruzada negada: tenant_memberships", JSON.parse(mb.body).length === 0, "");
const pg = await rest(A.token, `platform_access_grants?user_id=eq.${B.userId}&select=*`);
log("leitura cruzada negada: platform_access_grants", JSON.parse(pg.body).length === 0, "");
const prof = await rest(A.token, `profiles?id=eq.${B.userId}&select=*`);
log("leitura cruzada negada: profiles", JSON.parse(prof.body).length === 0, "");

// === 2. update cruzado ===
for (const [t, id] of tables) {
  const r = await rest(A.token, `${t}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(t === "appointments" ? { status: "cancelled" } : t === "financial_entries" ? { amount_cents: 1 } : { name: "HACKED" }) });
  let rows: any = []; try { rows = JSON.parse(r.body); } catch { rows = null; }
  const denied = r.status >= 400 || (Array.isArray(rows) && rows.length === 0);
  log(`update cruzado negado: ${t}`, denied, `status=${r.status}`);
}
// === 3. delete cruzado ===
for (const [t, id] of tables) {
  const r = await rest(A.token, `${t}?id=eq.${id}`, { method: "DELETE" });
  let rows: any = []; try { rows = JSON.parse(r.body); } catch { rows = null; }
  log(`delete cruzado negado: ${t}`, r.status >= 400 || (Array.isArray(rows) && rows.length === 0), `status=${r.status}`);
}
// === 4. insert com tenant_id alheio ===
const insTests: [string, any][] = [
  ["clients", { tenant_id: B.tenantId, name: "Injetado" }],
  ["services", { tenant_id: B.tenantId, name: "Injetado", duration_minutes: 10, price_cents: 100 }],
  ["professionals", { tenant_id: B.tenantId, name: "Injetado", commission_percent: 10 }],
  ["products", { tenant_id: B.tenantId, name: "Injetado", cost_cents: 1, sale_price_cents: 2, stock_quantity: 1, minimum_stock: 0, unit: "un" }],
  ["financial_entries", { tenant_id: B.tenantId, entry_type: "revenue", description: "Injetado", amount_cents: 999999, due_date: new Date().toISOString().slice(0, 10), status: "paid", origin: "manual" }],
  ["appointments", { tenant_id: B.tenantId, client_id: sb.cli.id, service_id: sb.svc.id, professional_id: sb.pro.id, starts_at: new Date(Date.now() + 172800000).toISOString(), ends_at: new Date(Date.now() + 172800000 + 600000).toISOString(), price_cents: 1, status: "scheduled" }],
  ["professional_ledger_entries", { tenant_id: B.tenantId, professional_id: sb.pro.id, kind: "commission", amount_cents: 1, competence_date: new Date().toISOString().slice(0, 10), description: "Injetado" }],
  ["tenant_memberships", { tenant_id: B.tenantId, user_id: A.userId, role: "owner" }],
];
for (const [t, payload] of insTests) {
  const r = await rest(A.token, t, { method: "POST", body: JSON.stringify(payload) });
  log(`insert em tenant alheio negado: ${t}`, r.status >= 400, `status=${r.status} ${r.body.slice(0, 50)}`);
}
// === 5. cruzamento de relação dentro do próprio tenant (client de B em appointment de A) ===
const crossRel = await rest(A.token, "appointments", { method: "POST", body: JSON.stringify({ tenant_id: A.tenantId, client_id: sb.cli.id, service_id: sa.svc.id, professional_id: sa.pro.id, starts_at: new Date(Date.now() + 259200000).toISOString(), ends_at: new Date(Date.now() + 259200000 + 600000).toISOString(), price_cents: 1, status: "scheduled" }) });
log("relação cruzada (cliente de B em agendamento de A) negada", crossRel.status >= 400, `status=${crossRel.status} ${crossRel.body.slice(0,60)}`);

// === 6. troca de tenant não autorizada ===
const sw = await rpc(A.token, "switch_active_tenant", { target_tenant_id: B.tenantId });
log("switch_active_tenant para tenant alheio negado", sw.status >= 400 || sw.body === "false", `status=${sw.status} ${sw.body.slice(0,60)}`);
const bootAfter = JSON.parse((await rpc(A.token, "get_my_session_bootstrap", {})).body);
log("tenant ativo permanece o próprio após tentativa", bootAfter.activeTenantId === A.tenantId, `${bootAfter.activeTenantId?.slice(0,8)}`);

// === 7. escalada de privilégio / RPCs administrativas ===
const esc1 = await rest(A.token, `tenant_memberships?tenant_id=eq.${A.tenantId}&user_id=eq.${A.userId}`, { method: "PATCH", body: JSON.stringify({ role: "owner" }) });
const escGrant = await rest(A.token, "platform_access_grants", { method: "POST", body: JSON.stringify({ email: A.email, user_id: A.userId, product_type: "beauty", access_type: "administrator", status: "active", plan_code: "team" }) });
log("auto-concessão de acesso administrador de plataforma negada", escGrant.status >= 400, `status=${escGrant.status}`);
const adminRpc = await rpc(A.token, "admin_list_platform_access", {});
log("admin_list_platform_access negada a usuário comum", adminRpc.status >= 400 || adminRpc.body === "[]", `status=${adminRpc.status} ${adminRpc.body.slice(0,50)}`);
const adminUp = await rpc(A.token, "admin_upsert_platform_access", { target_email: A.email, target_product: "beauty", target_access_type: "administrator", target_status: "active" });
log("admin_upsert_platform_access negada a usuário comum", adminUp.status >= 400, `status=${adminUp.status} ${adminUp.body.slice(0,60)}`);
const claim = await rpc(A.token, "claim_professional_access", {});
log("claim_professional_access não concede papel indevido", claim.status >= 400 || !String(claim.body).includes(B.tenantId), `status=${claim.status} ${claim.body.slice(0,60)}`);

// === 8. dados públicos de outro tenant não expõem dados internos ===
const tenantBrow = JSON.parse((await rest(sec, `tenants?id=eq.${B.tenantId}&select=slug`)).body)[0];
const pub = await rpc(anon, "get_public_company_page_v3", { company_slug: tenantBrow.slug });
const pubTxt = pub.body;
const leaks = ["\"email\":\"qa.audit", sb.cli.phone ?? "+5511999990000", "commission_percent", "manage_token", "cost_cents"].filter((s) => pubTxt.includes(s));
log("página pública não expõe clientes/telefones/comissões", leaks.length === 0, `status=${pub.status} leaks=${leaks.join("|") || "nenhum"}`);
const anonIns = await fetch(`${url}/rest/v1/clients`, { method: "POST", headers: H(anon), body: JSON.stringify({ tenant_id: B.tenantId, name: "AnonAtk" }) });
log("insert anônimo em clients negado", anonIns.status >= 400, `status=${anonIns.status}`);

console.log(out.join("\n"));
console.log(`\nTOTAL ${out.filter(l=>l.startsWith("PASS")).length}/${out.length} PASS`);
await Bun.write(".qa/audit-state.json", JSON.stringify({ A, B, sa, sb }, null, 2));
