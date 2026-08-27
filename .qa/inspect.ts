const url = "https://vctmjgezsdfwblemrjav.supabase.co";
const key = process.env.PROD_SUPABASE_SECRET_KEY!;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
async function get(p: string) {
  const r = await fetch(`${url}/rest/v1/${p}`, { headers: h });
  return { status: r.status, body: await r.text() };
}
for (const t of ["tenants?slug=eq.top-barbers-277e3e0c&select=*", "professionals?select=*&limit=1", "services?select=*&limit=2", "service_combo_items?select=*&limit=2", "appointments?select=*&limit=1", "professional_ledger_entries?select=*&limit=1", "professional_services?select=*&limit=1", "tenant_licenses?select=*&limit=1"]) {
  const r = await get(t);
  console.log("###", t, r.status, r.body.slice(0, 1600), "\n");
}
