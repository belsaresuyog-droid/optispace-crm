import { env } from "cloudflare:workers";
import { requireRequestUser } from "../../../lib/auth";

const safeJson=(value:unknown)=>{try{return JSON.parse(String(value||"{}"));}catch{return {};}};
const calendarDate=(value:unknown)=>{const text=String(value||"").trim();const indian=text.match(/^(\d{1,2})[-/]([01]?\d)[-/](20\d{2})$/);return indian?`${indian[3]}-${String(indian[2]).padStart(2,"0")}-${String(indian[1]).padStart(2,"0")}`:text.slice(0,10);};
const dateAfterDays=(value:unknown,days:unknown)=>{const date=new Date(`${calendarDate(value)}T00:00:00`);date.setDate(date.getDate()+Math.max(0,Math.max(1,Number(days)||1)-1));return calendarDate(date.toISOString());};
const ensureSchema=async()=>{await env.DB.prepare(`CREATE TABLE IF NOT EXISTS calendar_event_dismissals (event_key text PRIMARY KEY NOT NULL,dismissed_at text DEFAULT CURRENT_TIMESTAMP NOT NULL)`).run();await env.DB.prepare(`CREATE TABLE IF NOT EXISTS calendar_custom_events (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,enq_no text NOT NULL,role text NOT NULL,title text NOT NULL,starts_at text NOT NULL,ends_at text,email text DEFAULT '',location text DEFAULT '',notes text DEFAULT '',recurrence text DEFAULT 'One-time',series_end text DEFAULT '',visit_days integer DEFAULT 1,event_type text DEFAULT 'Visit',weekly_holiday text DEFAULT '',public_holiday text DEFAULT '',created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (enq_no) REFERENCES leads(enq_no))`).run();for(const column of ["ends_at text","email text DEFAULT ''","location text DEFAULT ''","recurrence text DEFAULT 'One-time'","series_end text DEFAULT ''","visit_days integer DEFAULT 1","event_type text DEFAULT 'Visit'","weekly_holiday text DEFAULT ''","public_holiday text DEFAULT ''"]){try{await env.DB.prepare(`ALTER TABLE calendar_custom_events ADD COLUMN ${column}`).run();}catch{} }try{await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS calendar_custom_events_occurrence_idx ON calendar_custom_events (enq_no,role,title,starts_at)").run();}catch{} };

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
    env.DB.prepare(`SELECT c.id,c.enq_no enqNo,c.role,c.title,c.starts_at startsAt,c.ends_at endsAt,c.email,c.location,c.notes,c.recurrence,c.series_end seriesEnd,c.visit_days visitDays,c.event_type eventType,c.weekly_holiday weeklyHoliday,c.public_holiday publicHoliday,l.company_name companyName,l.client_name clientName FROM calendar_custom_events c INNER JOIN leads l ON l.enq_no=c.enq_no WHERE l.deleted_at IS NULL ORDER BY c.starts_at DESC LIMIT 1000`).all(),
  ]);
  const dismissed=new Set((dismissals.results as any[]).map(row=>String(row.eventKey)));
  const events:any[]=[];
  for(const row of touchpoints.results as any[]){
    if(row.scheduledAt&&!dismissed.has(`followup-${row.id}`))events.push({id:`followup-${row.id}`,source:"FOLLOW_UP",role:undefined,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:"Next action",startsAt:row.scheduledAt,notes:row.notes||""});
  }
  for(const row of calls.results as any[]){const payload=safeJson(row.payloadJson),id=`call-${row.id}`;if(!dismissed.has(id))events.push({id,source:row.callType,role:payload.calendarRole||payload.role,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:row.callType==="VIDEO"?"Video call":"Audio call",startsAt:row.occurredAt,notes:payload.discussion||payload.nextAction||""});}
  for(const row of visits.results as any[]){const payload=safeJson(row.payloadJson),id=`visit-${row.id}`,date=calendarDate(payload.visitDate);if(date&&!dismissed.has(id))events.push({id,source:"VISIT",role:payload.calendarRole||payload.role,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:"Factory visit",startsAt:`${date}T${payload.visitTime||"09:00"}:00`,notes:payload.plantLocation||""});}
  const customSeen=new Set<string>();
  for(const row of customEvents.results as any[]){const id=`custom-${row.id}`,key=`${row.enqNo}|${row.role}|${row.title}|${row.startsAt}`;if(customSeen.has(key))continue;customSeen.add(key);if(!dismissed.has(id))events.push({id,source:"FOLLOW_UP",role:row.role,enqNo:row.enqNo,companyName:row.companyName,clientName:row.clientName,title:row.title,startsAt:row.startsAt,endsAt:dateAfterDays(row.startsAt,row.visitDays),email:row.email||"",location:row.location||"",notes:row.notes||"",recurrence:row.recurrence||"One-time",seriesEnd:row.seriesEnd||row.endsAt||row.startsAt,visitDays:Number(row.visitDays)||1,eventType:String(row.eventType||"VISIT").toUpperCase(),weeklyHoliday:row.weeklyHoliday||"",publicHoliday:row.publicHoliday||""});}
  events.sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt)));
  return Response.json({events});
}

export async function POST(request:Request){
  const auth=await requireRequestUser(request);if(auth.response)return auth.response;
  await ensureSchema();
  const body=await request.json() as {enqNo?:string;role?:string;title?:string;startsAt?:string;endsAt?:string;email?:string;location?:string;notes?:string;recurrence?:string;seriesEnd?:string;visitDays?:number;weeklyHoliday?:string;publicHoliday?:string};
  const enqNo=String(body.enqNo||"").trim(),role=String(body.role||"").toUpperCase(),title=String(body.title||"").trim(),startsAt=String(body.startsAt||"").trim(),endsAt=String(body.endsAt||"").trim();
  if(!enqNo||!title||!startsAt||!endsAt||!(["ARCHITECT","CONSULTANT"] as string[]).includes(role))return Response.json({error:"Lead, role, title, from date and to date are required."},{status:400});
  if(endsAt<startsAt)return Response.json({error:"To date must be on or after the from date."},{status:400});
  const lead=await env.DB.prepare("SELECT enq_no enqNo FROM leads WHERE enq_no=? AND deleted_at IS NULL AND lower(status) LIKE '%converted%'").bind(enqNo).first();
  if(!lead)return Response.json({error:"Only converted leads can have calendar events."},{status:400});
  const sameDate=await env.DB.prepare("SELECT id FROM calendar_custom_events WHERE enq_no=? AND role=? AND title=? AND starts_at=? LIMIT 1").bind(enqNo,role,title,startsAt).first<{id:number}>();
  if(sameDate)return Response.json({id:Number(sameDate.id),duplicate:true});
  // A project's overall duration may overlap other projects. Only this
  // concrete visit window is scheduled, so move it forward by whole weeks
  // until the selected role has an open window.
  let scheduledStart=startsAt,scheduledEnd=endsAt,rescheduled=false;
  for(let attempt=0;attempt<104;attempt++){
    const visitConflict=await env.DB.prepare("SELECT id FROM calendar_custom_events WHERE role=? AND starts_at<=? AND COALESCE(ends_at,starts_at)>=? LIMIT 1").bind(role,scheduledEnd,scheduledStart).first();
    if(!visitConflict)break;
    const nextStart=new Date(`${scheduledStart}T00:00:00`),nextEnd=new Date(`${scheduledEnd}T00:00:00`);
    nextStart.setDate(nextStart.getDate()+7);nextEnd.setDate(nextEnd.getDate()+7);
    scheduledStart=calendarDate(nextStart.toISOString());scheduledEnd=calendarDate(nextEnd.toISOString());rescheduled=true;
  }
  const result=await env.DB.prepare("INSERT OR IGNORE INTO calendar_custom_events (enq_no,role,title,starts_at,ends_at,email,location,notes,recurrence,series_end,visit_days,weekly_holiday,public_holiday) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(enqNo,role,title,scheduledStart,scheduledEnd,String(body.email||"").trim(),String(body.location||"").trim(),String(body.notes||""),String(body.recurrence||"One-time"),String(body.seriesEnd||startsAt),Math.max(1,Number(body.visitDays)||1),String(body.weeklyHoliday||""),String(body.publicHoliday||"")).run();
  if(!result.meta.changes){const existing=await env.DB.prepare("SELECT id FROM calendar_custom_events WHERE enq_no=? AND role=? AND title=? AND starts_at=? LIMIT 1").bind(enqNo,role,title,startsAt).first<{id:number}>();return Response.json({id:Number(existing?.id||0),duplicate:true});}
  return Response.json({id:Number(result.meta.last_row_id),startsAt:scheduledStart,endsAt:scheduledEnd,rescheduled},{status:201});
}

export async function PATCH(request:Request){
  const auth=await requireRequestUser(request);if(auth.response)return auth.response;
  await ensureSchema();const body=await request.json() as {id?:string;enqNo?:string;role?:string;title?:string;startsAt?:string;endsAt?:string;email?:string;location?:string;notes?:string;recurrence?:string;visitDays?:number;toDate?:string;eventType?:string};
  const visitMatch=String(body.id||"").match(/^visit-(\d+)$/);
  if(visitMatch){
    const id=Number(visitMatch[1]),date=calendarDate(body.startsAt);
    if(!date)return Response.json({error:"A visit date is required."},{status:400});
    const existing=await env.DB.prepare("SELECT payload_json payloadJson FROM visit_forms WHERE id=?").bind(id).first<{payloadJson:string}>();
    if(!existing)return Response.json({error:"Visit event was not found."},{status:404});
    const payload=safeJson(existing.payloadJson);payload.visitDate=date;
    await env.DB.prepare("UPDATE visit_forms SET payload_json=? WHERE id=?").bind(JSON.stringify(payload),id).run();
    return Response.json({updated:true,id:`visit-${id}`,visitDate:date});
  }
  const dateOnlyCustom=String(body.id||"").match(/^custom-(\d+)$/);
  if(dateOnlyCustom && body.startsAt && !body.enqNo){
    const id=Number(dateOnlyCustom[1]),existing=await env.DB.prepare("SELECT enq_no enqNo,role,title,starts_at startsAt,ends_at endsAt,email,location,notes,recurrence,series_end seriesEnd,visit_days visitDays FROM calendar_custom_events WHERE id=?").bind(id).first<{enqNo:string;role:string;title:string;startsAt:string;endsAt:string;email:string;location:string;notes:string;recurrence:string;seriesEnd:string;visitDays:number}>();
    if(!existing)return Response.json({error:"Calendar event was not found."},{status:404});
    const newStart=calendarDate(body.startsAt),newEnd=new Date(`${newStart}T00:00:00`);
    newEnd.setDate(newEnd.getDate()+Math.max(0,Math.max(1,Number(existing.visitDays)||1)-1));
    const visitConflict=await env.DB.prepare("SELECT id FROM calendar_custom_events WHERE id<>? AND role=? AND starts_at<=? AND COALESCE(ends_at,starts_at)>=? LIMIT 1").bind(id,existing.role,calendarDate(newEnd.toISOString()),newStart).first();
    if(visitConflict)return Response.json({error:`A ${String(existing.role).toLowerCase()} visit already exists on one or more of the selected dates.`},{status:409});
    await env.DB.prepare("UPDATE calendar_custom_events SET starts_at=?,ends_at=? WHERE id=?").bind(newStart,calendarDate(newEnd.toISOString()),id).run();
    return Response.json({updated:true,id:`custom-${id}`,startsAt:newStart,endsAt:calendarDate(newEnd.toISOString())});
  }
  const match=String(body.id||"").match(/^custom-(\d+)$/);if(!match)return Response.json({error:"A custom calendar event id is required."},{status:400});
  const id=Number(match[1]),enqNo=String(body.enqNo||"").trim(),role=String(body.role||"").toUpperCase(),title=String(body.title||"").trim(),startsAt=String(body.startsAt||"").trim(),endsAt=String(body.endsAt||"").trim();
  if(!enqNo||!title||!startsAt||!endsAt||!( ["ARCHITECT","CONSULTANT"] as string[]).includes(role))return Response.json({error:"Lead, role, title, from date and to date are required."},{status:400});
  if(endsAt<startsAt)return Response.json({error:"To date must be on or after the from date."},{status:400});
  const lead=await env.DB.prepare("SELECT enq_no FROM leads WHERE enq_no=? AND deleted_at IS NULL AND lower(status) LIKE '%converted%'").bind(enqNo).first();if(!lead)return Response.json({error:"Only converted leads can have calendar events."},{status:400});
  const existing=await env.DB.prepare("SELECT enq_no enqNo,role,title FROM calendar_custom_events WHERE id=?").bind(id).first<{enqNo:string;role:string;title:string}>();
  if(!existing)return Response.json({error:"Calendar event was not found."},{status:404});
  const visitConflict=await env.DB.prepare("SELECT id FROM calendar_custom_events WHERE id<>? AND role=? AND starts_at<=? AND COALESCE(ends_at,starts_at)>=? LIMIT 1").bind(id,role,endsAt,startsAt).first();
  if(visitConflict)return Response.json({error:`A ${role.toLowerCase()} visit already exists on one or more of the selected dates.`},{status:409});
  // An edit applies only to the selected occurrence. Other weekly/monthly
  // visits remain unchanged and can be edited independently.
  const recurrence=String(body.recurrence||"One-time"),seriesEnd=String(body.toDate||endsAt),duration=Math.max(1,Number(body.visitDays)||1);
  await env.DB.prepare("UPDATE calendar_custom_events SET enq_no=?,role=?,title=?,starts_at=?,ends_at=?,email=?,location=?,notes=?,recurrence=?,series_end=?,visit_days=? WHERE id=?").bind(enqNo,role,title,startsAt,endsAt,String(body.email||"").trim(),String(body.location||"").trim(),String(body.notes||""),recurrence,seriesEnd,duration,id).run();
  return Response.json({updated:true,id,occurrences:1});
}

export async function DELETE(request:Request){
  const auth=await requireRequestUser(request);if(auth.response)return auth.response;
  await ensureSchema();
  const url=new URL(request.url),id=url.searchParams.get("id")?.trim()||"",single=url.searchParams.get("single")==="true";
  if(!/^(followup|call|visit|custom)-\d+$/.test(id))return Response.json({error:"A valid calendar event id is required."},{status:400});
  const [kind,rawId]=id.split("-"),recordId=Number(rawId);
  const table=kind==="followup"?"touchpoints":kind==="call"?"information_gathering":kind==="visit"?"visit_forms":"calendar_custom_events";
  let deleted:any;
  if(kind==="custom"){
    const existing=await env.DB.prepare("SELECT enq_no enqNo,role,title FROM calendar_custom_events WHERE id=?").bind(recordId).first<{enqNo:string;role:string;title:string}>();
    if(existing){deleted=single?await env.DB.prepare("DELETE FROM calendar_custom_events WHERE id=? RETURNING id").bind(recordId).first():await env.DB.prepare("DELETE FROM calendar_custom_events WHERE enq_no=? AND role=? AND title=? RETURNING id").bind(existing.enqNo,existing.role,existing.title).first();}
  }else deleted=await env.DB.prepare(`DELETE FROM ${table} WHERE id=? RETURNING id`).bind(recordId).first<{id:number}>();
  if(!deleted)return Response.json({error:"Calendar event was not found."},{status:404});
  await env.DB.prepare("DELETE FROM calendar_event_dismissals WHERE event_key=?").bind(id).run();
  return Response.json({removed:true,deleted:true,id});
}
