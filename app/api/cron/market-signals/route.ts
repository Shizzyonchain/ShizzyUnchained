import { GET as marketSignals } from "../../market-signals/route";
export const maxDuration=60;
export async function GET(request:Request){
 if(!process.env.CRON_SECRET||request.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({error:"Unauthorized"},{status:401});
 const results=await Promise.allSettled(["24h","1h"].map(async period=>{const response=await marketSignals(new Request(`https://internal/api/market-signals?period=${period}`));const body=await response.json();return {period,available:Boolean(body.buying),asOf:body.buying?.asOf,delayed:body.buying?.delayed};}));
 return Response.json({results:results.map(r=>r.status==="fulfilled"?r.value:{error:"Refresh failed"})},{headers:{"Cache-Control":"no-store"}});
}
