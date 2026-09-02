const url="https://vctmjgezsdfwblemrjav.supabase.co";
const sec=process.env.PROD_SUPABASE_SECRET_KEY!;
const anon="sb_publishable_DdzRB5DSvp73mnDbdLfraw_wm87F8p0";
const H=(k:string,extra:Record<string,string>={})=>({apikey:k,Authorization:`Bearer ${k}`,"Content-Type":"application/json",...extra});
const SH=H(sec);
const results:{name:string;pass:boolean;info:string}[]=[];
const check=(name:string,pass:boolean,info=""),=>0;
