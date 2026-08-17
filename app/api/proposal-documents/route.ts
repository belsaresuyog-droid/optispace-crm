import { env } from "cloudflare:workers";

let ready=false;
async function ensureSchema(){
  if(ready)return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS proposal_documents (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    proposal_no text NOT NULL UNIQUE,
    enq_no text NOT NULL,
    payload_json text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (enq_no) REFERENCES leads(enq_no)
  )`).run();
  await env.DB.prepare(
    "UPDATE proposal_documents SET payload_json=REPLACE(payload_json, ?, ?) WHERE INSTR(payload_json, ?) > 0",
  ).bind("502000024663081", "50200002466308", "502000024663081").run();
  ready=true;
}
export async function GET(){
  await ensureSchema();
  const rows=await env.DB.prepare(`SELECT p.id,p.proposal_no proposalNo,p.enq_no enqNo,p.payload_json payloadJson,p.created_at createdAt,p.updated_at updatedAt,l.company_name companyName,l.client_name clientName
    FROM proposal_documents p JOIN leads l ON l.enq_no=p.enq_no WHERE l.deleted_at IS NULL ORDER BY p.updated_at DESC,p.id DESC`).all();
  return Response.json({proposals:rows.results.map((row:any)=>({...row,payload:JSON.parse(row.payloadJson)}))});
}
export async function POST(request:Request){
  await ensureSchema();const body=await request.json() as {enqNo?:string;payload?:unknown};const enqNo=String(body.enqNo||"").trim();
  if(!enqNo)return Response.json({error:"Select a lead before creating the proposal."},{status:400});
  const exists=await env.DB.prepare("SELECT enq_no FROM leads WHERE enq_no=? AND deleted_at IS NULL").bind(enqNo).first();
  if(!exists)return Response.json({error:"Lead not found."},{status:404});
  const existingProposal=await env.DB.prepare("SELECT id,proposal_no proposalNo FROM proposal_documents WHERE enq_no=? LIMIT 1").bind(enqNo).first<{id:number;proposalNo:string}>();
  if(existingProposal)return Response.json(
    {error:`This lead already has proposal ${existingProposal.proposalNo}. Open the existing proposal to view or edit it.`,proposalId:existingProposal.id},
    {status:409},
  );
  const next=Number((await env.DB.prepare(
    "SELECT COALESCE(MAX(CAST(SUBSTR(proposal_no, 6) AS INTEGER)), 0) + 1 next FROM proposal_documents WHERE proposal_no LIKE '2627P%'",
  ).first<{next:number}>())?.next||1);
  const proposalNo=`2627P${String(next).padStart(3,"0")}`;
  try{
    const result=await env.DB.prepare("INSERT INTO proposal_documents (proposal_no,enq_no,payload_json) VALUES (?,?,?)").bind(proposalNo,enqNo,JSON.stringify(body.payload||{})).run();
    return Response.json({id:Number(result.meta.last_row_id),proposalNo,enqNo},{status:201});
  }catch(error){
    console.error("Proposal creation failed",error);
    return Response.json({error:"Proposal could not be created. Please refresh the proposal register and try again."},{status:409});
  }
}
export async function PATCH(request:Request){
  await ensureSchema();const body=await request.json() as {id?:number;payload?:unknown};const id=Number(body.id);
  if(!id)return Response.json({error:"Proposal record id is required."},{status:400});
  await env.DB.prepare("UPDATE proposal_documents SET payload_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(body.payload||{}),id).run();
  return Response.json({updated:true,id});
}
export async function DELETE(request:Request){await ensureSchema();const id=Number(new URL(request.url).searchParams.get("id"));if(!id)return Response.json({error:"Proposal record id is required."},{status:400});const result=await env.DB.prepare("DELETE FROM proposal_documents WHERE id=?").bind(id).run();if(!result.meta.changes)return Response.json({error:"Proposal not found."},{status:404});return Response.json({deleted:true,id});}
