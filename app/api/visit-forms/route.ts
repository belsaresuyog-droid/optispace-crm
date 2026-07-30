import { desc, eq, isNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { leads, visitForms } from "../../../db/schema";

let schemaReady=false;
async function ensureSchema(){
  if(schemaReady)return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS visit_forms (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    enq_no text NOT NULL,
    payload_json text NOT NULL,
    completed_at text,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (enq_no) REFERENCES leads(enq_no)
  )`).run();
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
  schemaReady=true;
}

export async function GET(){
  await ensureSchema();
  const rows=await getDb().select({id:visitForms.id,enqNo:visitForms.enqNo,payloadJson:visitForms.payloadJson,completedAt:visitForms.completedAt,createdAt:visitForms.createdAt,companyName:leads.companyName,clientName:leads.clientName})
    .from(visitForms).innerJoin(leads,eq(visitForms.enqNo,leads.enqNo)).where(isNull(leads.deletedAt)).orderBy(desc(visitForms.createdAt),desc(visitForms.id)).limit(1000);
  return Response.json({visitForms:rows.map(row=>({...row,payload:JSON.parse(row.payloadJson)}))});
}

export async function POST(request:Request){
  await ensureSchema();
  const body=await request.json() as {enqNo?:string;payload?:unknown;completed?:boolean};
  const enqNo=String(body.enqNo || "").trim();
  if(!enqNo || !body.payload)return Response.json({error:"Lead and visit data are required."},{status:400});
  const lead=await getDb().select({enqNo:leads.enqNo}).from(leads).where(eq(leads.enqNo,enqNo)).limit(1);
  if(!lead.length)return Response.json({error:"Lead not found."},{status:404});
  const audioQualification=await env.DB.prepare("SELECT id FROM information_gathering WHERE enq_no=? AND call_type='AUDIO' LIMIT 1").bind(enqNo).first();
  if(!audioQualification)return Response.json({error:"Complete Audio Call qualification before creating a Visit Form."},{status:409});
  const existing=await getDb().select({id:visitForms.id}).from(visitForms).where(eq(visitForms.enqNo,enqNo)).orderBy(desc(visitForms.id)).limit(1);
  if(existing.length){
    const [record]=await getDb().update(visitForms).set({payloadJson:JSON.stringify(body.payload),completedAt:body.completed===false?null:new Date().toISOString()}).where(eq(visitForms.id,existing[0].id)).returning();
    return Response.json({visitForm:{...record,payload:body.payload},updated:true});
  }
  const [record]=await getDb().insert(visitForms).values({enqNo,payloadJson:JSON.stringify(body.payload),completedAt:body.completed===false?null:new Date().toISOString()}).returning();
  return Response.json({visitForm:{...record,payload:body.payload}},{status:201});
}

export async function PATCH(request:Request){
  await ensureSchema();
  const body=await request.json() as {id?:number;enqNo?:string;payload?:unknown;completed?:boolean};
  const id=Number(body.id);
  if(!id || !body.enqNo || !body.payload)return Response.json({error:"Record id, lead and visit data are required."},{status:400});
  const [record]=await getDb().update(visitForms).set({enqNo:String(body.enqNo),payloadJson:JSON.stringify(body.payload),completedAt:body.completed===false?null:new Date().toISOString()}).where(eq(visitForms.id,id)).returning();
  if(!record)return Response.json({error:"Visit form not found."},{status:404});
  return Response.json({visitForm:{...record,payload:body.payload}});
}

export async function DELETE(request:Request){
  await ensureSchema();
  const id=Number(new URL(request.url).searchParams.get("id"));
  if(!id)return Response.json({error:"Visit record id is required."},{status:400});
  const [record]=await getDb().delete(visitForms).where(eq(visitForms.id,id)).returning({id:visitForms.id});
  if(!record)return Response.json({error:"Visit form not found."},{status:404});
  return Response.json({deleted:true,id});
}
