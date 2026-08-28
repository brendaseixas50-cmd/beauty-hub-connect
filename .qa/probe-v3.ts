const url = "https://vctmjgezsdfwblemrjav.supabase.co";
const key = process.env.PROD_SUPABASE_SECRET_KEY!;
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
async function rpc(fn: string, args: unknown) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers: h, body: JSON.stringify(args) });
  return `${r.status} ${(await r.text()).slice(0, 300)}`;
}
console.log("digest público:", await rpc("nonexistent_probe", {}));
console.log("v3:", await rpc("create_public_booking_v3", { p_slug: "top-barbers-277e3e0c", p_service_ids: ["00000000-0000-0000-0000-000000000000"], p_professional_id: null, p_starts_at: new Date(Date.now()+864e5*3).toISOString(), p_customer_name: "QA Probe", p_customer_phone: "85999990000", p_request_id: crypto.randomUUID(), p_fingerprint: "probe", p_payment_method: "local", p_payment_option: "full", p_honeypot: "" }));
