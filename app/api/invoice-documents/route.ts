import { env } from "cloudflare:workers";

let ready=false;
async function ensureSchema(){
  if(ready)return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS invoice_documents (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    invoice_no text NOT NULL UNIQUE,
    enq_no text NOT NULL,
    mode text DEFAULT 'Proforma' NOT NULL,
    payload_json text NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (enq_no) REFERENCES leads(enq_no)
  )`).run();ready=true;
}
export async function GET(){await ensureSchema();const rows=await env.DB.prepare(`SELECT i.id,i.invoice_no invoiceNo,i.enq_no enqNo,i.mode,i.payload_json payloadJson,i.created_at createdAt,i.updated_at updatedAt,l.company_name companyName,l.client_name clientName FROM invoice_documents i JOIN leads l ON l.enq_no=i.enq_no WHERE l.deleted_at IS NULL ORDER BY i.updated_at DESC,i.id DESC`).all();return Response.json({invoices:rows.results.map((row:any)=>({...row,payload:JSON.parse(row.payloadJson)}))});}
export async function POST(request:Request){await ensureSchema();const body=await request.json() as {enqNo?:string;mode?:string;payload?:unknown};const enqNo=String(body.enqNo||"").trim();if(!enqNo)return Response.json({error:"Select a lead before creating the invoice."},{status:400});if(!await env.DB.prepare("SELECT enq_no FROM leads WHERE enq_no=? AND deleted_at IS NULL").bind(enqNo).first())return Response.json({error:"Lead not found."},{status:404});const next=Number((await env.DB.prepare("SELECT count(*) count FROM invoice_documents").first<{count:number}>())?.count||0)+1;const invoiceNo=`2627OS${String(next).padStart(3,"0")}`;const mode=body.mode==="Tax"?"Tax":"Proforma";const result=await env.DB.prepare("INSERT INTO invoice_documents (invoice_no,enq_no,mode,payload_json) VALUES (?,?,?,?)").bind(invoiceNo,enqNo,mode,JSON.stringify(body.payload||{})).run();return Response.json({id:Number(result.meta.last_row_id),invoiceNo,enqNo,mode},{status:201});}
export async function PATCH(request:Request){await ensureSchema();const body=await request.json() as {id?:number;mode?:string;payload?:unknown};const id=Number(body.id);if(!id)return Response.json({error:"Invoice record id is required."},{status:400});await env.DB.prepare("UPDATE invoice_documents SET mode=?,payload_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.mode==="Tax"?"Tax":"Proforma",JSON.stringify(body.payload||{}),id).run();return Response.json({updated:true,id});}
export async function DELETE(request:Request){await ensureSchema();const id=Number(new URL(request.url).searchParams.get("id"));if(!id)return Response.json({error:"Invoice record id is required."},{status:400});const result=await env.DB.prepare("DELETE FROM invoice_documents WHERE id=?").bind(id).run();if(!result.meta.changes)return Response.json({error:"Invoice not found."},{status:404});return Response.json({deleted:true,id});}
