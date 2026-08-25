const url = "https://vctmjgezsdfwblemrjav.supabase.co";
const key = process.env.PROD_SUPABASE_SECRET_KEY!;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const stamp = Date.now();
const email = `qa.combo.${stamp}@luia-qa.dev`;
const password = `Qa!${stamp}aA`;
const u = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: h, body: JSON.stringify({ email, password, email_confirm: true }) });
const user = await u.json();
for (const product of ["beauty", "barber"]) {
  await fetch(`${url}/rest/v1/platform_access_grants`, { method: "POST", headers: h, body: JSON.stringify({ email, user_id: user.id, product_type: product, access_type: "beta_tester", status: "active", plan_code: "team" }) });
}
await Bun.write(".qa/state.json", JSON.stringify({ email, password, userId: user.id }, null, 2));
console.log("READY", email);
