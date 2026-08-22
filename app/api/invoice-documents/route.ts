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
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS proposal_negotiations (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    proposal_id integer NOT NULL UNIQUE,
    enq_no text NOT NULL,
    original_area real NOT NULL,
    negotiated_area real NOT NULL,
    original_proposal_value real NOT NULL,
    negotiated_proposal_value real NOT NULL,
    original_travel_value real NOT NULL,
    negotiated_travel_value real NOT NULL,
    scope_json text DEFAULT '{}' NOT NULL,
    travel_json text DEFAULT '{}' NOT NULL,
    notes text DEFAULT '' NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`).run();ready=true;
}
function travelBreakdown(travel:any){const cab=Number(travel?.cabCost)||0,travelCost=cab>0?cab:(Number(travel?.km)||0)*(Number(travel?.kmRate)||0),stayCost=(Number(travel?.days)||0)*(Number(travel?.people)||0)*(Number(travel?.stayRate)||0);return {travelCost,stayCost,travelStay:travelCost+stayCost};}
function travelValue(travel:any){return travelBreakdown(travel).travelStay;}
function negotiatedPayload(payload:Record<string,any>,negotiation:any,sourcePayload:Record<string,any>={}){
  if(!negotiation)return payload;
  const negotiatedSourceTravel=sourcePayload.negotiated?.travel||{};
  const sourceTravel=travelValue(negotiatedSourceTravel)>0?negotiatedSourceTravel:sourcePayload.travel||{};
  const negotiatedTravel=negotiation.negotiatedTravelJson?JSON.parse(String(negotiation.negotiatedTravelJson)):{};
  const existing=payload.details||{};
  const breakdown=travelValue(negotiatedTravel)>0?travelBreakdown(negotiatedTravel):travelValue(sourceTravel)>0?travelBreakdown(sourceTravel):{travelCost:Number(existing.travelCost ?? existing.travelStay)||0,stayCost:Number(existing.stayCost)||0,travelStay:Number(existing.travelStay)||0};
  return {...payload,details:{...(payload.details||{}),basic:Number(negotiation.negotiatedProposalValue)||0,...breakdown,commercialSource:"Negotiated proposal",proposalId:Number(negotiation.proposalId),negotiationUpdatedAt:negotiation.negotiationUpdatedAt}};
}
function applyPaymentStep(payload:Record<string,any>,sourcePayload:Record<string,any>,stepIndex:number){
  const milestones=Array.isArray(sourcePayload.paymentMilestones)&&sourcePayload.paymentMilestones.length?sourcePayload.paymentMilestones:Array.isArray(sourcePayload.details?.paymentMilestones)&&sourcePayload.details.paymentMilestones.length?sourcePayload.details.paymentMilestones:[{description:"Advance payment",timing:"With purchase order",percent:100}];
  const index=Math.min(Math.max(Number.isFinite(stepIndex)?stepIndex:0,0),milestones.length-1),step=milestones[index]||milestones[0],totalBasic=Number(payload.details?.basic)||0,percent=Number(String(step.percent??0).replace("%",""))||0;
  const details=payload.details||{},travelCost=Number(details.travelCost ?? details.travelStay ?? 0)||0,stayCost=Number(details.stayCost)||0;
  return {...payload,paymentStepIndex:index,paymentStepLabel:String(step.description||`Payment step ${index+1}`),paymentStepPercent:percent,details:{...details,basic:Number((totalBasic*percent/100).toFixed(2)),travelCost,stayCost,travelStay:travelCost+stayCost,activity:String(step.description||details.activity||"Project milestone"),paymentStepTiming:String(step.timing||"")}};
}
export async function GET(){await ensureSchema();const rows=await env.DB.prepare(`SELECT i.id,i.invoice_no invoiceNo,i.enq_no enqNo,i.mode,i.payload_json payloadJson,i.created_at createdAt,i.updated_at updatedAt,l.company_name companyName,l.client_name clientName,pn.proposal_id proposalId,pn.negotiated_proposal_value negotiatedProposalValue,pn.travel_json negotiatedTravelJson,pn.updated_at negotiationUpdatedAt FROM invoice_documents i JOIN leads l ON l.enq_no=i.enq_no LEFT JOIN proposal_negotiations pn ON pn.enq_no=i.enq_no WHERE l.deleted_at IS NULL ORDER BY i.updated_at DESC,i.id DESC`).all();const invoices=await Promise.all(rows.results.map(async(row:any)=>{let sourcePayload:Record<string,any>={};if(row.proposalId){try{const proposal=await env.DB.prepare("SELECT payload_json payloadJson FROM proposal_documents WHERE id=?").bind(Number(row.proposalId)).first<any>();if(proposal)sourcePayload=JSON.parse(String(proposal.payloadJson||"{}"));}catch{}}const payload=negotiatedPayload(JSON.parse(row.payloadJson),row.proposalId?row:null,sourcePayload);return {...row,payload};}));return Response.json({invoices});}
export async function POST(request:Request){await ensureSchema();const body=await request.json() as {enqNo?:string;mode?:string;payload?:Record<string,any>;milestoneIndex?:number};const enqNo=String(body.enqNo||"").trim();if(!enqNo)return Response.json({error:"Select a lead before creating the invoice."},{status:400});if(!await env.DB.prepare("SELECT enq_no FROM leads WHERE enq_no=? AND deleted_at IS NULL").bind(enqNo).first())return Response.json({error:"Lead not found."},{status:404});let negotiation=await env.DB.prepare(`SELECT proposal_id proposalId,negotiated_proposal_value negotiatedProposalValue,travel_json negotiatedTravelJson,updated_at negotiationUpdatedAt FROM proposal_negotiations WHERE enq_no=? ORDER BY updated_at DESC LIMIT 1`).bind(enqNo).first<any>();let sourcePayload:Record<string,any>={};if(!negotiation){try{const proposal=await env.DB.prepare(`SELECT p.id proposalId,p.payload_json payloadJson,p.updated_at negotiationUpdatedAt,l.proposal_value leadValue FROM proposal_documents p JOIN leads l ON l.enq_no=p.enq_no WHERE p.enq_no=? ORDER BY p.updated_at DESC LIMIT 1`).bind(enqNo).first<any>();if(proposal){sourcePayload=JSON.parse(String(proposal.payloadJson||"{}"));const details=sourcePayload.details||{},area=Number(details.buildingArea)||0,scope=sourcePayload.scope||{};const calculated=Object.values(scope as Record<string,any>).reduce((sum:number,item:any)=>sum+(item?.enabled?Number(item.rate)||0:0),0)*area;negotiation={proposalId:Number(proposal.proposalId),negotiatedProposalValue:Number(sourcePayload.negotiated?.proposalValue||details.basic||calculated||proposal.leadValue||0),negotiatedTravelJson:JSON.stringify(travelValue(sourcePayload.negotiated?.travel||{})>0?sourcePayload.negotiated.travel:sourcePayload.travel||{}),negotiationUpdatedAt:proposal.negotiationUpdatedAt};}}catch{ /* proposal table may not exist in an older database */ }}else{try{const proposal=await env.DB.prepare("SELECT payload_json payloadJson FROM proposal_documents WHERE id=?").bind(Number(negotiation.proposalId)).first<any>();if(proposal)sourcePayload=JSON.parse(String(proposal.payloadJson||"{}"));}catch{ /* proposal table may not exist in an older database */ }}if(!negotiation)return Response.json({error:"Create a proposal for this lead before creating an invoice."},{status:409});const existingInvoices=await env.DB.prepare("SELECT payload_json payloadJson FROM invoice_documents WHERE enq_no=? ORDER BY id ASC").bind(enqNo).all();const usedSteps=new Set<number>();(existingInvoices.results||[]).forEach((row:any,index:number)=>{try{const stored=JSON.parse(String(row.payloadJson||"{}"));const step=Number(stored.paymentStepIndex);usedSteps.add(Number.isInteger(step)&&step>=0?step:index);}catch{usedSteps.add(index);}});let serverStep=0;while(usedSteps.has(serverStep))serverStep+=1;const next=Number((await env.DB.prepare("SELECT count(*) count FROM invoice_documents").first<{count:number}>())?.count||0)+1;const invoiceNo=`2627OS${String(next).padStart(3,"0")}`;const mode=body.mode==="Tax"?"Tax":"Proforma",payload=applyPaymentStep(negotiatedPayload(body.payload||{},negotiation),sourcePayload,serverStep);const result=await env.DB.prepare("INSERT INTO invoice_documents (invoice_no,enq_no,mode,payload_json) VALUES (?,?,?,?)").bind(invoiceNo,enqNo,mode,JSON.stringify(payload)).run();return Response.json({id:Number(result.meta.last_row_id),invoiceNo,enqNo,mode,payload});}
export async function PATCH(request:Request){await ensureSchema();const body=await request.json() as {id?:number;mode?:string;payload?:unknown};const id=Number(body.id);if(!id)return Response.json({error:"Invoice record id is required."},{status:400});await env.DB.prepare("UPDATE invoice_documents SET mode=?,payload_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.mode==="Tax"?"Tax":"Proforma",JSON.stringify(body.payload||{}),id).run();return Response.json({updated:true,id});}
export async function DELETE(request:Request){await ensureSchema();const id=Number(new URL(request.url).searchParams.get("id"));if(!id)return Response.json({error:"Invoice record id is required."},{status:400});const result=await env.DB.prepare("DELETE FROM invoice_documents WHERE id=?").bind(id).run();if(!result.meta.changes)return Response.json({error:"Invoice not found."},{status:404});return Response.json({deleted:true,id});}
