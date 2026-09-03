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
const st = JSON.parse(await Bun.file(".qa/audit-state.json").text());
const A = st.A, B = st.B, sa = st.sa, sb = st.sb;

// ---- admin RPCs com assinatura real, chamadas por usuário comum ----
const up = await rpc(A.token, "admin_upsert_platform_access", { target_email: A.email, target_product: "beauty", target_access_type: "administrator", target_status: "active", target_plan: "business", target_expires_at: null, target_notes: null });
log("admin_upsert_platform_access negada a não-admin", up.status >= 400, `status=${up.status} ${up.body.slice(0,90)}`);
const rm = await rpc(A.token, "admin_remove_platform_access", { target_id: st.A.userId });
log("admin_remove_platform_access negada a não-admin", rm.status >= 400, `status=${rm.status} ${rm.body.slice(0,90)}`);
const fa = await rpc(A.token, "admin_find_auth_user_id", { p_email: B.email });
log("admin_find_auth_user_id negada a não-admin", fa.status >= 400 || fa.body === "null", `status=${fa.status} ${fa.body.slice(0,90)}`);
const lk = await rpc(A.token, "admin_link_professional_account", { p_professional_id: sb.pro.id, p_user_id: A.userId });
log("admin_link_professional_account negada a não-admin", lk.status >= 400, `status=${lk.status} ${lk.body.slice(0,90)}`);
for (const fn of ["admin_list_platform_access", "admin_upsert_platform_access", "admin_find_auth_user_id"]) {
  const r = await rpc(anon, fn, fn === "admin_find_auth_user_id" ? { p_email: B.email } : fn === "admin_upsert_platform_access" ? { target_email: "x@x.com", target_product: "beauty", target_access_type: "administrator", target_status: "active", target_plan: "solo", target_expires_at: null, target_notes: null } : {});
  log(`anônimo bloqueado em ${fn}`, r.status >= 400, `status=${r.status}`);
}
// escalada via grant próprio (update)
const selfGrant = await rest(A.token, `platform_access_grants?user_id=eq.${A.userId}`, { method: "PATCH", body: JSON.stringify({ access_type: "administrator", plan_code: "business" }) });
let sgRows: any = null; try { sgRows = JSON.parse(selfGrant.body); } catch {}
log("usuário não altera o próprio nível de acesso/plano", selfGrant.status >= 400 || (Array.isArray(sgRows) && sgRows.length === 0), `status=${selfGrant.status}`);
const boot = JSON.parse((await rpc(A.token, "get_my_session_bootstrap", {})).body);
log("bootstrap não reporta administrador de plataforma", boot.platformAccess.isAdministrator === false, `${JSON.stringify(boot.platformAccess.grants).slice(0,90)}`);

// ---- superfície pública ----
const slugA = JSON.parse((await rest(sec, `tenants?id=eq.${A.tenantId}&select=slug`)).body)[0].slug;
await rest(A.token, `services?id=eq.${sa.svc.id}`, { method: "PATCH", body: JSON.stringify({ active: true }) });
await rest(A.token, `tenants?id=eq.${A.tenantId}`, { method: "PATCH", body: JSON.stringify({ onboarding_completed: true }) });
const page = await rpc(anon, "get_public_company_page_v3", { p_slug: slugA });
const leakTerms = [A.email, "commission_percent", "cost_cents", "manage_token", "+5511999990000", "financial"];
const found = leakTerms.filter((t) => page.body.includes(t));
log("página pública responde a anônimo", page.status === 200 && page.body.length > 20, `status=${page.status} len=${page.body.length}`);
log("página pública não vaza e-mail/comissão/custo/telefone de cliente", found.length === 0, found.join("|") || "nenhum");
const pageB = await rpc(anon, "get_public_company_page_v3", { p_slug: slugA });
log("página pública contém apenas dados do próprio tenant", !pageB.body.includes(B.tenantId), "");
const avail = await rpc(anon, "get_public_booking_availability_v4", { p_slug: slugA, p_service_id: sa.svc.id, p_professional_id: sa.pro.id, p_date: new Date(Date.now() + 172800000).toISOString().slice(0, 10), p_addons: [], p_addon_professionals: [] });
log("disponibilidade pública responde sem sessão", avail.status === 200, `status=${avail.status} ${avail.body.slice(0,80)}`);
// slug inexistente não deve derrubar nem expor
const bad = await rpc(anon, "get_public_company_page_v3", { p_slug: "nao-existe-xyz" });
log("slug inexistente tratado sem erro interno", bad.status < 500, `status=${bad.status} ${bad.body.slice(0,60)}`);
// leitura anônima direta de tabelas sensíveis
for (const t of ["appointments", "clients", "financial_entries", "professional_ledger_entries", "mercado_pago_connections", "platform_access_grants", "tenant_memberships", "profiles", "public_booking_tokens"]) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, { headers: H(anon) });
  const body = await r.text();
  let rows: any = null; try { rows = JSON.parse(body); } catch {}
  log(`anônimo sem leitura em ${t}`, r.status >= 400 || (Array.isArray(rows) && rows.length === 0), `status=${r.status}`);
}
console.log(out.join("\n"));
console.log(`\nTOTAL ${out.filter((l) => l.startsWith("PASS")).length}/${out.length} PASS`);
