const url="https://vctmjgezsdfwblemrjav.supabase.co";const key=process.env.PROD_SUPABASE_SECRET_KEY!;
const h={apikey:key,Authorization:`Bearer ${key}`};
const g=async(p:string)=>await (await fetch(`${url}/rest/v1/${p}`,{headers:h})).json();
console.log(JSON.stringify(await g("appointments?booking_group_id=eq.5acd3897-5a98-433a-86f8-ddfe93a78e7b&select=id,professional_id,service_id,starts_at,ends_at,price_cents,public_code,status&order=starts_at"),null,1));
console.log(JSON.stringify(await g("professional_ledger_entries?select=professional_id,amount_cents,appointment_id&appointment_id=not.is.null&order=created_at.desc&limit=5")));
