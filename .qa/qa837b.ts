const url="https://vctmjgezsdfwblemrjav.supabase.co";
const key=process.env.PROD_SUPABASE_SECRET_KEY!;
const h={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
const g=async(p:string)=>await (await fetch(`${url}/rest/v1/${p}`,{headers:h})).json();
const rpc=async(fn:string,a:unknown)=>{const r=await fetch(`${url}/rest/v1/rpc/${fn}`,{method:"POST",headers:h,body:JSON.stringify(a)});return {s:r.status,d:await r.json().catch(()=>null)};};
const CORTE="69929979-6021-4f45-8dc5-61c7744f5070", UNHA="65013890-aa37-413e-b29d-3be2274a47e6";
const ANTHONY="49c2cc4a-0ebe-443e-ba0e-1a5a0b831517", BRUNA="d2ec7937-45b4-44d5-b4ee-f5372f2d1c3d";
const slug="top-barbers-277e3e0c";
// garantir que Unha da mão é adicional do Corte
const link=(await g(`service_addon_links?parent_service_id=eq.${CORTE}&addon_service_id=eq.${UNHA}&select=*`));
console.log("link corte->unha:",link);
const page=(await rpc("get_public_company_page_v3",{p_slug:slug})).d;
const corte=page.services.find((s:any)=>s.id===CORTE);
console.log("corte elig:",corte.eligibleProfessionalIds,"addons:",JSON.stringify(corte.addons));
const date="2026-09-03";
const av=(await rpc("get_public_booking_availability_v4",{p_slug:slug,p_date:date,p_service_ids:[CORTE,UNHA],p_professional_id:ANTHONY,p_addon_professionals:{}})).d;
console.log("slots:",av.slots?.length, JSON.stringify(av.slots?.slice(0,2)));
if(av.slots?.length){
  const st=av.slots[0].startsAt;
  const plan=(await rpc("booking_blocks_plan_v2",{p_tenant_id:"4071a52f-66ad-4253-8a48-bf5c1768e02d",p_service_ids:[CORTE,UNHA],p_professional_id:ANTHONY,p_addon_professionals:{},p_starts_at:st})).d;
  console.log("plan:",JSON.stringify(plan));
  const book=(await rpc("create_public_booking_v5",{p_slug:slug,p_service_ids:[CORTE,UNHA],p_professional_id:ANTHONY,p_starts_at:st,p_customer_name:"QA Addon",p_customer_phone:"85999990001",p_request_id:crypto.randomUUID(),p_fingerprint:"qa-addon-837",p_payment_method:"local",p_payment_option:"full",p_honeypot:"",p_addon_professionals:{}})).d;
  console.log("booking:",JSON.stringify(book));
  const rows=await g(`appointments?fingerprint=eq.qa-addon-837&select=id,professional_id,service_id,starts_at,ends_at,price_cents,public_code,booking_group_id,status&order=starts_at`);
  console.log("rows:",JSON.stringify(rows,null,1));
}
