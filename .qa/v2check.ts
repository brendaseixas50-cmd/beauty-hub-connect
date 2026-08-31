const url="https://vctmjgezsdfwblemrjav.supabase.co";
const key=process.env.PROD_SUPABASE_SECRET_KEY!;
const h={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
async function rpc(fn:string,args:unknown){const r=await fetch(`${url}/rest/v1/rpc/${fn}`,{method:"POST",headers:h,body:JSON.stringify(args)});return {s:r.status,t:(await r.text()).slice(0,400)};}
for (const fn of ["booking_blocks_plan_v2","get_public_booking_availability_v4","create_public_booking_v5","professional_is_free"]) {
  const r=await rpc(fn,{});
  console.log(fn, r.s, r.t.slice(0,160));
}
