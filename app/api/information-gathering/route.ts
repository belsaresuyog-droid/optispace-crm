import { env } from "cloudflare:workers";

let ready=false;
async function ensureSchema(){
  if(ready)return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS information_gathering (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    enq_no text NOT NULL,
    call_type text NOT NULL,
    payload_json text NOT NULL,
    occurred_at text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (enq_no) REFERENCES leads(enq_no) ON DELETE CASCADE
  )`).run();
  ready=true;
}

const map=(row:any)=>({id:Number(row.id),enqNo:row.enq_no,callType:row.call_type,payload:JSON.parse(row.payload_json||"{}"),occurredAt:row.occurred_at,createdAt:row.created_at,updatedAt:row.updated_at,companyName:row.company_name,clientName:row.client_name,actionCount:Number(row.action_count||0)});

export async function GET(request:Request){
  await ensureSchema();
  const type=new URL(request.url).searchParams.get("type");
  const filter=type==="AUDIO"||type==="VIDEO"?type:"";
  const result=filter
    ?await env.DB.prepare(`SELECT i.*,l.company_name,l.client_name,(SELECT count(*) FROM touchpoints t WHERE t.enq_no=i.enq_no AND t.type=CASE WHEN i.call_type='AUDIO' THEN 'PHONE' ELSE 'VIDEO' END) action_count FROM information_gathering i INNER JOIN leads l ON l.enq_no=i.enq_no WHERE l.deleted_at IS NULL AND i.call_type=? ORDER BY i.occurred_at DESC,i.id DESC`).bind(filter).all()
    :await env.DB.prepare(`SELECT i.*,l.company_name,l.client_name,(SELECT count(*) FROM touchpoints t WHERE t.enq_no=i.enq_no AND t.type=CASE WHEN i.call_type='AUDIO' THEN 'PHONE' ELSE 'VIDEO' END) action_count FROM information_gathering i INNER JOIN leads l ON l.enq_no=i.enq_no WHERE l.deleted_at IS NULL ORDER BY i.occurred_at DESC,i.id DESC`).all();
  return Response.json({records:(result.results||[]).map(map)});
}

function validate(body:Record<string,unknown>){
  const enqNo=String(body.enqNo||"").trim(),callType=body.callType==="VIDEO"?"VIDEO":body.callType==="AUDIO"?"AUDIO":"",occurredAt=String(body.occurredAt||"").trim(),payload=body.payload;
  if(!enqNo)return {error:"Please select a lead."};
  if(!callType)return {error:"Call type is required."};
  if(!occurredAt)return {error:"Call date and time are required."};
  if(!payload||typeof payload!=="object")return {error:"Call information is required."};
  return {enqNo,callType,occurredAt,payload};
}

export async function POST(request:Request){
  await ensureSchema();const body=await request.json() as Record<string,unknown>,data=validate(body);if("error" in data)return Response.json({error:data.error},{status:400});
  if(!await env.DB.prepare("SELECT enq_no FROM leads WHERE enq_no=? AND deleted_at IS NULL").bind(data.enqNo).first())return Response.json({error:"Lead not found."},{status:404});
  const existing=await env.DB.prepare("SELECT id FROM information_gathering WHERE enq_no=? AND call_type=? ORDER BY id DESC LIMIT 1").bind(data.enqNo,data.callType).first<{id:number}>();
  if(existing){
    const record=await env.DB.prepare("UPDATE information_gathering SET payload_json=?,occurred_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *").bind(JSON.stringify(data.payload),data.occurredAt,existing.id).first();
    return Response.json({record:map(record),updated:true});
  }
  const record=await env.DB.prepare("INSERT INTO information_gathering (enq_no,call_type,payload_json,occurred_at) VALUES (?,?,?,?) RETURNING *").bind(data.enqNo,data.callType,JSON.stringify(data.payload),data.occurredAt).first();
  return Response.json({record:map(record)},{status:201});
}

export async function PATCH(request:Request){
  await ensureSchema();const body=await request.json() as Record<string,unknown>,id=Number(body.id),data=validate(body);if(!id)return Response.json({error:"Record id is required."},{status:400});if("error" in data)return Response.json({error:data.error},{status:400});
  const record=await env.DB.prepare("UPDATE information_gathering SET enq_no=?,call_type=?,payload_json=?,occurred_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? RETURNING *").bind(data.enqNo,data.callType,JSON.stringify(data.payload),data.occurredAt,id).first();
  if(!record)return Response.json({error:"Information record not found."},{status:404});
  return Response.json({record:map(record)});
}

export async function DELETE(request:Request){
  await ensureSchema();const url=new URL(request.url),id=Number(url.searchParams.get("id"));if(!id)return Response.json({error:"Record id is required."},{status:400});
  const existing=await env.DB.prepare("SELECT id,enq_no enqNo,call_type callType FROM information_gathering WHERE id=?").bind(id).first<{id:number;enqNo:string;callType:string}>();
  if(!existing)return Response.json({error:"Information record not found."},{status:404});
  if(url.searchParams.get("resetLead")==="1"&&existing.callType==="AUDIO"){
    const now=new Date().toISOString();
    const results=await env.DB.batch([
      env.DB.prepare("DELETE FROM information_gathering WHERE enq_no=?").bind(existing.enqNo),
      env.DB.prepare("DELETE FROM visit_forms WHERE enq_no=?").bind(existing.enqNo),
      env.DB.prepare("DELETE FROM factory_data WHERE enq_no=?").bind(existing.enqNo),
      env.DB.prepare("DELETE FROM touchpoints WHERE enq_no=?").bind(existing.enqNo),
      env.DB.prepare("UPDATE leads SET status='LEAD_RECEIVED',engagement_type=NULL,last_action='Lead received',next_action='Qualifying phone call',age_label='Just now',updated_at=? WHERE enq_no=? AND deleted_at IS NULL").bind(now,existing.enqNo),
    ]);
    return Response.json({deleted:true,reset:true,enqNo:existing.enqNo,deletedInformation:Number(results[0]?.meta?.changes||0),deletedVisits:Number(results[1]?.meta?.changes||0),deletedFactoryData:Number(results[2]?.meta?.changes||0),deletedTouchpoints:Number(results[3]?.meta?.changes||0)});
  }
  const record=await env.DB.prepare("DELETE FROM information_gathering WHERE id=? RETURNING id").bind(id).first();
  return Response.json({deleted:true,id});
}
