import { env } from "cloudflare:workers";
import { requireRequestUser } from "../../../lib/auth";

const safeJson=(value:unknown)=>{try{return JSON.parse(String(value||"{}"));}catch{return {};}};
const ensureSchema=async()=>{await env.DB.prepare(`CREATE TABLE IF NOT EXISTS calendar_event_dismissals (event_key text PRIMARY KEY NOT NULL,dismissed_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`).run();await env.DB.prepare(`CREATE TABLE IF NOT EXISTS calendar_custom_events (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,enq_no text NOT NULL,role text NOT NULL,title text NOT NULL,starts_at text NOT NULL,ends_at text,email text DEFAULT '',location text DEFAULT '',notes text DEFAULT '',created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (enq_no) REFERENCES leads(enq_no))`).run();try{await env.DB.prepare("ALTER TABLE calendar_custom_events ADD COLUMN ends_at text").run();}catch{}try{await env.DB.prepare("ALTER TABLE calendar_custom_events ADD COLUMN email text DEFAULT ''").run();}catch{}try{await env.DB.prepare("ALTER TABLE calendar_custom_events ADD COLUMN location text DEFAULT ''").run();}catch{} };

export async function GET(request:Request){
  const auth=await requireRequestUser(request);
  if(auth.response)return auth.response;
  await ensureSchema();
  const [touchpoints,calls,visits,dismissals,customEvents]=await Promise.all([
    env.DB.prepare(`SELECT t.id,t.enq_no enqNo,t.type,t.scheduled_at scheduledAt,t.occurred_at occurredAt,t.notes,l.company_name companyName,l.client_name clientName
      FROM touchpoints t INNER JOIN leads l ON l.enq_no=t.enq_no WHERE l.deleted_at IS NULL ORDER BY COALESCE(t.scheduled_at,t.occurred_at,t.created_at) DESC LIMIT 2000`).all(),
    env.DB.prepare(`SELECT i.id,i.enq_no enqNo,i.call_type callType,i.occurred_at occurredAt,i.payload_json payloadJson,l.company_name companyName,l.client_name clientName
      FROM information_gathering i INNER JOIN leads l ON l.enq_no=i.enq_no WHERE l.deleted_at IS NULL ORDER BY i.occurred_at DESC LIMIT 1000`).all(),
    env.DB.prepare(`SELECT v.id,v.enq_no enqNo,v.payload_json payloadJson,v.completed_at completedAt,v.created_at createdAt,l.company_name companyName,l.client_name clientName
      FROM visit_forms v INNER JOIN leads l ON l.enq_no=v.enq_no WHERE l.deleted_at IS NULL ORDER BY v.created_at DESC LIMIT 1000`).all(),
    env.DB.prepare("SELECT event_key eventKey FROM calendar_event_dismissals").all(),
    env.DB.prepare(`SELECT c.id,c.enq_no enqNo,c.role,c.title,c.starts_at startsAt,c.ends_at endsAt,c.email,c.location,c.notes,l.company_name companyName,l.client_name clientName FROM calendar_custom_events c INNER JOIN leads l ON l.enq_no=c.enq_no WHERE l.deleted_at IS NULL ORDER BY c.starts_at DESC LIMIT 1000`).all(),
  ]);
  const dismissed=new Set((dismissals.results as any[]).map(row=>String(row.eventKey)));
  const events:any[]=[];
  for(const row of touchpoints.results as any[]){
    if(row.scheduledAt&&!dismissed.has(`followup-${row.id}`))events.push({id:`followup-${row.id}`,source:"FOLLOW_UP",role:undefined,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:"Next action",startsAt:row.scheduledAt,notes:row.notes||""});
  }
  for(const row of calls.results as any[]){const payload=safeJson(row.payloadJson),id=`call-${row.id}`;if(!dismissed.has(id))events.push({id,source:row.callType,role:payload.calendarRole||payload.role,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:row.callType==="VIDEO"?"Video call":"Audio call",startsAt:row.occurredAt,notes:payload.discussion||payload.nextAction||""});}
  for(const row of visits.results as any[]){const payload=safeJson(row.payloadJson),id=`visit-${row.id}`,date=payload.visitDate;if(date&&!dismissed.has(id))events.push({id,source:"VISIT",role:payload.calendarRole||payload.role,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:"Factory visit",startsAt:`${date}T${payload.visitTime||"09:00"}:00`,notes:payload.plantLocation||""});}
  for(const row of customEvents.results as any[]){const id=`custom-${row.id}`;if(!dismissed.has(id))events.push({id,source:"FOLLOW_UP",role:row.role,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:row.title,startsAt:row.startsAt,endsAt:row.endsAt||"",email:row.email||"",location:row.location||"",notes:row.notes||""});}
  events.sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt)));
  return Response.json({events});
}

export async function POST(request:Request){
  const auth=await requireRequestUser(request);if(auth.response)return auth.response;
  await ensureSchema();
  const body=await request.json() as {enqNo?:string;role?:string;title?:string;startsAt?:string;endsAt?:string;email?:string;location?:string;notes?:string};
  const enqNo=String(body.enqNo||"").trim(),role=String(body.role||"").toUpperCase(),title=String(body.title||"").trim(),startsAt=String(body.startsAt||"").trim(),endsAt=String(body.endsAt||"").trim();
  if(!enqNo||!title||!startsAt||!endsAt||!(["ARCHITECT","CONSULTANT"] as string[]).includes(role))return Response.json({error:"Lead, role, title, from date and to date are required."},{status:400});
  if(endsAt<startsAt)return Response.json({error:"To date must be on or after the from date."},{status:400});
  const lead=await env.DB.prepare("SELECT enq_no enqNo FROM leads WHERE enq_no=? AND deleted_at IS NULL AND lower(status) LIKE '%converted%'").bind(enqNo).first();
  if(!lead)return Response.json({error:"Only converted leads can have calendar events."},{status:400});
  const overlap=await env.DB.prepare("SELECT id FROM calendar_custom_events WHERE enq_no=? AND role=? AND starts_at<=? AND COALESCE(ends_at,starts_at)>=? LIMIT 1").bind(enqNo,role,endsAt,startsAt).first();
  if(overlap)return Response.json({error:"This visit date overlaps an existing event for the selected lead."},{status:409});
  const result=await env.DB.prepare("INSERT INTO calendar_custom_events (enq_no,role,title,starts_at,ends_at,email,location,notes) VALUES (?,?,?,?,?,?,?,?)").bind(enqNo,role,title,startsAt,endsAt,String(body.email||"").trim(),String(body.location||"").trim(),String(body.notes||"")).run();
  return Response.json({id:Number(result.meta.last_row_id)},{status:201});
}

export async function PATCH(request:Request){
  const auth=await requireRequestUser(request);if(auth.response)return auth.response;
  await ensureSchema();const body=await request.json() as {id?:string;enqNo?:string;role?:string;title?:string;startsAt?:string;endsAt?:string;email?:string;location?:string;notes?:string};
  const match=String(body.id||"").match(/^custom-(\d+)$/);if(!match)return Response.json({error:"A custom calendar event id is required."},{status:400});
  const id=Number(match[1]),enqNo=String(body.enqNo||"").trim(),role=String(body.role||"").toUpperCase(),title=String(body.title||"").trim(),startsAt=String(body.startsAt||"").trim(),endsAt=String(body.endsAt||"").trim();
  if(!enqNo||!title||!startsAt||!endsAt||!( ["ARCHITECT","CONSULTANT"] as string[]).includes(role))return Response.json({error:"Lead, role, title, from date and to date are required."},{status:400});
  if(endsAt<startsAt)return Response.json({error:"To date must be on or after the from date."},{status:400});
  const lead=await env.DB.prepare("SELECT enq_no FROM leads WHERE enq_no=? AND deleted_at IS NULL AND lower(status) LIKE '%converted%'").bind(enqNo).first();if(!lead)return Response.json({error:"Only converted leads can have calendar events."},{status:400});
  const overlap=await env.DB.prepare("SELECT id FROM calendar_custom_events WHERE enq_no=? AND role=? AND id<>? AND starts_at<=? AND COALESCE(ends_at,starts_at)>=? LIMIT 1").bind(enqNo,role,id,endsAt,startsAt).first();if(overlap)return Response.json({error:"This visit date overlaps an existing event for the selected lead."},{status:409});
  const existing=await env.DB.prepare("SELECT enq_no enqNo,role,title FROM calendar_custom_events WHERE id=?").bind(id).first<{enqNo:string;role:string;title:string}>();
  if(existing?.enqNo&&existing.role&&existing.title)await env.DB.prepare("UPDATE calendar_custom_events SET enq_no=?,role=?,title=?,starts_at=?,ends_at=?,email=?,location=?,notes=? WHERE enq_no=? AND role=? AND title=?").bind(enqNo,role,title,startsAt,endsAt,String(body.email||"").trim(),String(body.location||"").trim(),String(body.notes||""),existing.enqNo,existing.role,existing.title).run();
  else await env.DB.prepare("UPDATE calendar_custom_events SET enq_no=?,role=?,title=?,starts_at=?,ends_at=?,email=?,location=?,notes=? WHERE id=?").bind(enqNo,role,title,startsAt,endsAt,String(body.email||"").trim(),String(body.location||"").trim(),String(body.notes||""),id).run();
  return Response.json({updated:true,id});
}

export async function DELETE(request:Request){
  const auth=await requireRequestUser(request);if(auth.response)return auth.response;
  await ensureSchema();
  const id=new URL(request.url).searchParams.get("id")?.trim()||"";
  if(!/^(followup|call|visit|custom)-\d+$/.test(id))return Response.json({error:"A valid calendar event id is required."},{status:400});
  const [kind,rawId]=id.split("-"),recordId=Number(rawId);
  const table=kind==="followup"?"touchpoints":kind==="call"?"information_gathering":kind==="visit"?"visit_forms":"calendar_custom_events";
  let deleted:any;
  if(kind==="custom"){
    const existing=await env.DB.prepare("SELECT enq_no enqNo,role,title FROM calendar_custom_events WHERE id=?").bind(recordId).first<{enqNo:string;role:string;title:string}>();
    if(existing){deleted=await env.DB.prepare("DELETE FROM calendar_custom_events WHERE enq_no=? AND role=? AND title=? RETURNING id").bind(existing.enqNo,existing.role,existing.title).first();}
  }else deleted=await env.DB.prepare(`DELETE FROM ${table} WHERE id=? RETURNING id`).bind(recordId).first<{id:number}>();
  if(!deleted)return Response.json({error:"Calendar event was not found."},{status:404});
  await env.DB.prepare("DELETE FROM calendar_event_dismissals WHERE event_key=?").bind(id).run();
  return Response.json({removed:true,deleted:true,id});
}
