const url="https://vctmjgezsdfwblemrjav.supabase.co";
const key=process.env.PROD_SUPABASE_SECRET_KEY!;
const h={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
const r=await fetch(`${url}/rest/v1/service_addon_links?select=parent_service_id,addon_service_id,professional_mode,preferred_fallback,assigned_professional_id&limit=3`,{headers:h});
console.log("addon cols:",r.status,(await r.text()).slice(0,400));
async function rpc(fn:string,a:unknown){const x=await fetch(`${url}/rest/v1/rpc/${fn}`,{method:"POST",headers:h,body:JSON.stringify(a)});return `${x.status} ${(await x.text()).slice(0,300)}`;}
console.log("v4:",await rpc("get_public_booking_availability_v4",{p_slug:"top-barbers-277e3e0c",p_date:"2026-09-03",p_service_ids:[],p_professional_id:null,p_addon_professionals:{}}));
console.log("page v3:",await rpc("get_public_company_page_v3",{p_slug:"top-barbers-277e3e0c"}));
