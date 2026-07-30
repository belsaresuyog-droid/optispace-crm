import { env } from "cloudflare:workers";

let ready=false;
async function ensureSchema(){
  if(ready)return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS factory_data (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    enq_no text NOT NULL UNIQUE,
    payload_json text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (enq_no) REFERENCES leads(enq_no) ON DELETE CASCADE
  )`).run();
  ready=true;
}
const map=(row:any)=>({id:Number(row.id),enqNo:row.enq_no,payload:JSON.parse(row.payload_json||"{}"),createdAt:row.created_at,updatedAt:row.updated_at,companyName:row.company_name,clientName:row.client_name});

export async function GET(){
  await ensureSchema();
  const result=await env.DB.prepare("SELECT f.*,l.company_name,l.client_name FROM factory_data f INNER JOIN leads l ON l.enq_no=f.enq_no WHERE l.deleted_at IS NULL ORDER BY f.updated_at DESC,f.id DESC").all();
  return Response.json({records:(result.results||[]).map(map)});
}

export async function POST(request:Request){
  await ensureSchema();
  const body=await request.json() as {enqNo?:string;payload?:unknown},enqNo=String(body.enqNo||"").trim();
  if(!enqNo||!body.payload)return Response.json({error:"Lead and factory data are required."},{status:400});
  const audio=await env.DB.prepare("SELECT id FROM information_gathering WHERE enq_no=? AND call_type='AUDIO' LIMIT 1").bind(enqNo).first();
  if(!audio)return Response.json({error:"Complete Audio Call qualification before entering factory data."},{status:409});
  const record=await env.DB.prepare(`INSERT INTO factory_data (enq_no,payload_json) VALUES (?,?)
    ON CONFLICT(enq_no) DO UPDATE SET payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP RETURNING *`).bind(enqNo,JSON.stringify(body.payload)).first();
  return Response.json({record:map(record)});
}
