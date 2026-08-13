import { env } from "cloudflare:workers";
import { requireRequestUser } from "../../../lib/auth";

const safeJson=(value:unknown)=>{try{return JSON.parse(String(value||"{}"));}catch{return {};}};
const ensureSchema=()=>env.DB.prepare(`CREATE TABLE IF NOT EXISTS calendar_event_dismissals (event_key text PRIMARY KEY NOT NULL,dismissed_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`).run();

export async function GET(request:Request){
  const auth=await requireRequestUser(request);
  if(auth.response)return auth.response;
  await ensureSchema();
  const [touchpoints,calls,visits,dismissals]=await Promise.all([
    env.DB.prepare(`SELECT t.id,t.enq_no enqNo,t.type,t.scheduled_at scheduledAt,t.occurred_at occurredAt,t.notes,l.company_name companyName,l.client_name clientName
      FROM touchpoints t INNER JOIN leads l ON l.enq_no=t.enq_no WHERE l.deleted_at IS NULL ORDER BY COALESCE(t.scheduled_at,t.occurred_at,t.created_at) DESC LIMIT 2000`).all(),
    env.DB.prepare(`SELECT i.id,i.enq_no enqNo,i.call_type callType,i.occurred_at occurredAt,i.payload_json payloadJson,l.company_name companyName,l.client_name clientName
      FROM information_gathering i INNER JOIN leads l ON l.enq_no=i.enq_no WHERE l.deleted_at IS NULL ORDER BY i.occurred_at DESC LIMIT 1000`).all(),
    env.DB.prepare(`SELECT v.id,v.enq_no enqNo,v.payload_json payloadJson,v.completed_at completedAt,v.created_at createdAt,l.company_name companyName,l.client_name clientName
      FROM visit_forms v INNER JOIN leads l ON l.enq_no=v.enq_no WHERE l.deleted_at IS NULL ORDER BY v.created_at DESC LIMIT 1000`).all(),
    env.DB.prepare("SELECT event_key eventKey FROM calendar_event_dismissals").all(),
  ]);
  const dismissed=new Set((dismissals.results as any[]).map(row=>String(row.eventKey)));
  const events:any[]=[];
  for(const row of touchpoints.results as any[]){
    if(row.scheduledAt&&!dismissed.has(`followup-${row.id}`))events.push({id:`followup-${row.id}`,source:"FOLLOW_UP",enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:"Next action",startsAt:row.scheduledAt,notes:row.notes||""});
  }
  for(const row of calls.results as any[]){const payload=safeJson(row.payloadJson),id=`call-${row.id}`;if(!dismissed.has(id))events.push({id,source:row.callType,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:row.callType==="VIDEO"?"Video call":"Audio call",startsAt:row.occurredAt,notes:payload.discussion||payload.nextAction||""});}
  for(const row of visits.results as any[]){const payload=safeJson(row.payloadJson),id=`visit-${row.id}`,date=payload.visitDate;if(date&&!dismissed.has(id))events.push({id,source:"VISIT",enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:"Factory visit",startsAt:`${date}T${payload.visitTime||"09:00"}:00`,notes:payload.plantLocation||""});}
  events.sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt)));
  return Response.json({events});
}

export async function DELETE(request:Request){
  const auth=await requireRequestUser(request);if(auth.response)return auth.response;
  await ensureSchema();
  const id=new URL(request.url).searchParams.get("id")?.trim()||"";
  if(!/^(followup|call|visit)-\d+$/.test(id))return Response.json({error:"A valid calendar event id is required."},{status:400});
  await env.DB.prepare("INSERT OR IGNORE INTO calendar_event_dismissals (event_key) VALUES (?)").bind(id).run();
  return Response.json({removed:true,id});
}
