import { desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { leads } from "../../../db/schema";
import { env } from "cloudflare:workers";

const areaToSqft: Record<string, number> = { SqFt: 1, SqM: 10.7639104167, Acre: 43560, Guntha: 1089 };
const statusMap: Record<string, "LEAD_RECEIVED" | "ENGAGED" | "PROPOSAL_TO_SEND" | "PROPOSAL_SENT" | "CONVERTED" | "ON_HOLD" | "REJECTED" | "STOP"> = { "Lead Received":"LEAD_RECEIVED", "Engagement Initiated":"ENGAGED", "Proposal To Be Sent":"PROPOSAL_TO_SEND", "Proposal Sent":"PROPOSAL_SENT", "Converted":"CONVERTED", "On Hold":"ON_HOLD", "Rejected":"REJECTED", "STOP":"STOP" };
const compact=(value:unknown)=>String(value??"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");
const phoneKey=(value:unknown)=>String(value??"").replace(/\D/g,"").slice(-10);
let schemaReady=false;
async function ensureFactoryDataSchema(){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS factory_data (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,enq_no text NOT NULL UNIQUE,payload_json text NOT NULL,created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (enq_no) REFERENCES leads(enq_no) ON DELETE CASCADE)`).run();}
async function ensureTouchpointsSchema(){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS touchpoints (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,enq_no text NOT NULL,type text NOT NULL,sequence_no integer,scheduled_at text,occurred_at text,completed integer DEFAULT false NOT NULL,travel_voucher_shared integer DEFAULT false NOT NULL,notes text DEFAULT '' NOT NULL,created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (enq_no) REFERENCES leads(enq_no))`).run();}
async function ensureSchema(){ if(schemaReady) return; await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leads (enq_no text PRIMARY KEY NOT NULL, client_name text NOT NULL, company_name text NOT NULL, email text NOT NULL, phone text NOT NULL, city text DEFAULT '' NOT NULL, address text DEFAULT '' NOT NULL, website text DEFAULT '' NOT NULL, products text DEFAULT '' NOT NULL, plot_area real DEFAULT 0 NOT NULL, built_up_area_sqft real NOT NULL, source_area_unit text DEFAULT 'SqFt' NOT NULL, operation_nature text DEFAULT '' NOT NULL, enquiry_source text NOT NULL, project_class text NOT NULL, status text DEFAULT 'LEAD_RECEIVED' NOT NULL, engagement_type text, high_potential integer DEFAULT false NOT NULL, last_action text DEFAULT '' NOT NULL, next_action text DEFAULT '' NOT NULL, age_label text DEFAULT '' NOT NULL, proposal_value real DEFAULT 0 NOT NULL, proposal_no text, received_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text)`).run(); await env.DB.prepare(`CREATE TABLE IF NOT EXISTS proposal_documents (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, proposal_no text NOT NULL UNIQUE, enq_no text NOT NULL, payload_json text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (enq_no) REFERENCES leads(enq_no))`).run(); await env.DB.prepare(`CREATE TABLE IF NOT EXISTS invoice_documents (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, invoice_no text NOT NULL UNIQUE, enq_no text NOT NULL, mode text DEFAULT 'Proforma' NOT NULL, payload_json text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (enq_no) REFERENCES leads(enq_no))`).run(); await env.DB.prepare(`CREATE TABLE IF NOT EXISTS travel_vouchers (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, voucher_no text NOT NULL UNIQUE, enq_no text NOT NULL, voucher_date text NOT NULL, site_location text DEFAULT '' NOT NULL, contact text DEFAULT '' NOT NULL, particulars text DEFAULT 'Travelling Expenses' NOT NULL, travel_from text DEFAULT 'Solutions Optispace' NOT NULL, travel_to text DEFAULT '' NOT NULL, amount real DEFAULT 0 NOT NULL, amount_words text DEFAULT '' NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (enq_no) REFERENCES leads(enq_no) ON DELETE CASCADE)`).run(); await env.DB.prepare(`CREATE TABLE IF NOT EXISTS information_gathering (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, enq_no text NOT NULL, call_type text NOT NULL, payload_json text NOT NULL, occurred_at text NOT NULL, created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, FOREIGN KEY (enq_no) REFERENCES leads(enq_no) ON DELETE CASCADE)`).run(); try{await env.DB.prepare("ALTER TABLE leads ADD deleted_at text").run();}catch{} try{await env.DB.prepare("ALTER TABLE leads ADD high_potential integer DEFAULT false NOT NULL").run();}catch{} try{await env.DB.prepare("ALTER TABLE leads ADD engagement_type text").run();}catch{} try{await env.DB.prepare("ALTER TABLE leads ADD products text DEFAULT '' NOT NULL").run();}catch{} schemaReady=true; }

export async function GET() {
  await ensureSchema();
  const rows = await getDb().select().from(leads).where(isNull(leads.deletedAt)).orderBy(desc(leads.receivedAt)).limit(1000);
  return Response.json({ leads: rows });
}

export async function POST(request: Request) {
  await ensureSchema();
  const p = await request.json() as Record<string, any>;
  if(Array.isArray(p.leads)){
    const db=getDb();
    const existing=await db.select().from(leads).where(isNull(leads.deletedAt)).limit(10000);
    const emails=new Set(existing.map(row=>compact(row.email)).filter(Boolean));
    const phones=new Set(existing.map(row=>phoneKey(row.phone)).filter(value=>value.length>=7));
    const names=new Set(existing.map(row=>`${compact(row.companyName)}|${compact(row.clientName)}`));
    const companies=new Set(existing.map(row=>compact(row.companyName)).filter(Boolean));
    let nextNumber=existing.reduce((max,row)=>Math.max(max,Number(String(row.enqNo).match(/(\d+)$/)?.[1]||0)),0)+1;
    const created=[] as any[], duplicates=[] as number[], invalid=[] as Array<{index:number;reason:string}>;
    for(const [index,item] of (p.leads as Array<Record<string,any>>).entries()){
      const clientName=String(item.clientName??"").trim(),companyName=String(item.companyName??"").trim(),email=String(item.email??"").trim(),phone=String(item.phone??"").trim();
      const bua=Number(item.builtUpArea??item.bua??0),unit=String(item.areaUnit??"SqFt");
      if(!companyName||!clientName||!phone||!(bua>0)||!areaToSqft[unit]){invalid.push({index:index+1,reason:"Company, contact, phone and built-up area are required."});continue;}
      if(email&&!/^\S+@\S+\.\S+$/.test(email)){invalid.push({index:index+1,reason:"Invalid email."});continue;}
      const emailKey=compact(email),mobileKey=phoneKey(phone),nameKey=`${compact(companyName)}|${compact(clientName)}`;
      if(companies.has(compact(companyName))||(emailKey&&emails.has(emailKey))||(mobileKey.length>=7&&phones.has(mobileKey))||names.has(nameKey)){duplicates.push(index+1);continue;}
      const enqNo=`E2627${String(nextNumber++).padStart(3,"0")}`;
      const [lead]=await db.insert(leads).values({enqNo,clientName,companyName,email,phone,city:String(item.city??"").trim(),address:String(item.address??"").trim(),website:String(item.website??"").trim(),products:String(item.products??"").trim(),plotArea:Number(item.plotArea??0),builtUpAreaSqft:Number((bua*areaToSqft[unit]).toFixed(2)),sourceAreaUnit:unit,operationNature:String(item.operationNature??"").trim(),enquirySource:String(item.enquirySource??"Website"),projectClass:String(item.projectClass??"Greenfield"),status:statusMap[String(item.status)]||"LEAD_RECEIVED",highPotential:Boolean(item.highPotential),lastAction:"Lead received",nextAction:"Qualifying phone call",ageLabel:"Just now",proposalValue:Number(item.value??0),proposalNo:null}).returning();
      created.push(lead);if(emailKey)emails.add(emailKey);if(mobileKey.length>=7)phones.add(mobileKey);names.add(nameKey);companies.add(compact(companyName));
    }
    return Response.json({created:created.length,duplicates:duplicates.length,invalid:invalid.length,duplicateRows:duplicates,invalidRows:invalid,leads:created},{status:created.length||duplicates.length||invalid.length?201:400});
  }
  const email = String(p.email ?? "").trim(); const bua = Number(p.builtUpArea); const unit = String(p.areaUnit ?? "SqFt");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Primary email is invalid." }, { status: 400 });
  if (!(bua > 0)) return Response.json({ error: "Built-up area is required and must be greater than zero." }, { status: 400 });
  if (!areaToSqft[unit]) return Response.json({ error: "Area unit must be SqFt, SqM, Acre, or Guntha." }, { status: 400 });
  const db = getDb();
  const companyName = String(p.companyName ?? "").trim();
  if (!companyName) return Response.json({ error: "Company name is required." }, { status: 400 });
  const activeLeads = await db.select({ companyName: leads.companyName }).from(leads).where(isNull(leads.deletedAt)).limit(10000);
  if (activeLeads.some(row => compact(row.companyName) === compact(companyName))) return Response.json({ error: "A lead with this company name already exists." }, { status: 409 });
  const count = await db.select({ value: sql<number>`count(*)` }).from(leads);
  const enqNo = `E2627${String(Number(count[0]?.value ?? 0) + 1).padStart(3, "0")}`;
  const [lead] = await db.insert(leads).values({ enqNo, clientName: String(p.clientName ?? "").trim(), companyName, email, phone: String(p.phone ?? "").trim(), city: String(p.city ?? "").trim(), address: String(p.address ?? "").trim(), website:String(p.website ?? "").trim(), products:String(p.products ?? "").trim(), plotArea: Number(p.plotArea ?? 0), builtUpAreaSqft: Number((bua * areaToSqft[unit]).toFixed(2)), sourceAreaUnit: unit, operationNature: String(p.operationNature ?? "").trim(), enquirySource: String(p.enquirySource ?? "SMM"), projectClass: String(p.projectClass ?? "Greenfield"), status:statusMap[String(p.status)] || "LEAD_RECEIVED", highPotential:Boolean(p.highPotential), lastAction:String(p.lastAction ?? "Lead received"), nextAction:String(p.nextAction ?? "Qualifying phone call"), ageLabel:String(p.age ?? "Just now"), proposalValue:Number(p.value ?? 0), proposalNo:String(p.proposalNo ?? "") || null }).returning();
  if(p.rawId){try{await env.DB.prepare("UPDATE raw_leads SET claimed_enq_no = ? WHERE id = ?").bind(enqNo,Number(p.rawId)).run();}catch{ /* raw lead table may not exist on older databases */ }}
  return Response.json({ lead }, { status: 201 });
}

export async function PATCH(request:Request){
  await ensureSchema();
  const p=await request.json() as Record<string,string|number>; const enqNo=String(p.enqNo ?? "").trim();
  if(!enqNo) return Response.json({error:"Enquiry number is required."},{status:400});
  const db=getDb();
  const [existing]=await db.select().from(leads).where(eq(leads.enqNo,enqNo)).limit(1);
  if(!existing||existing.deletedAt)return Response.json({error:"Lead was not found."},{status:404});
  const requestedCompany=String(p.companyName ?? p.company ?? existing.companyName).trim();
  if(!requestedCompany) return Response.json({error:"Company name is required."},{status:400});
  const sameCompany=await db.select({enqNo:leads.enqNo,companyName:leads.companyName}).from(leads).where(isNull(leads.deletedAt)).limit(10000);
  if(sameCompany.some(row=>row.enqNo!==enqNo&&compact(row.companyName)===compact(requestedCompany))) return Response.json({error:"A lead with this company name already exists."},{status:409});
  const status=statusMap[String(p.status)] || existing.status;
  const requestedEngagement=String(p.engagementType||"").trim();
  const validEngagement=["PHONE_CALL","VIDEO_CALL","ACTUAL_VISIT"].includes(requestedEngagement)
    ? requestedEngagement as "PHONE_CALL"|"VIDEO_CALL"|"ACTUAL_VISIT"
    : null;
  const engagementType=status==="ENGAGED"?(validEngagement||existing.engagementType||null):null;
  const values={ clientName:String(p.clientName ?? p.contact ?? existing.clientName).trim(), companyName:requestedCompany, email:String(p.email ?? existing.email).trim(), phone:String(p.phone ?? existing.phone).trim(), city:String(p.city ?? existing.city).trim(), address:String(p.address ?? existing.address), website:String(p.website ?? existing.website).trim(), products:String(p.products ?? existing.products).trim(), plotArea:Number(p.plotArea ?? existing.plotArea), builtUpAreaSqft:Number(p.builtUpArea ?? p.bua ?? existing.builtUpAreaSqft), sourceAreaUnit:existing.sourceAreaUnit||"SqFt", operationNature:String(p.operationNature ?? existing.operationNature), enquirySource:String(p.enquirySource ?? p.source ?? existing.enquirySource), projectClass:String(p.projectClass ?? p.project ?? existing.projectClass), status, engagementType, highPotential:p.highPotential===undefined?existing.highPotential:Boolean(p.highPotential), lastAction:String(p.lastAction ?? existing.lastAction), nextAction:String(p.nextAction ?? existing.nextAction), ageLabel:String(p.age ?? existing.ageLabel), proposalValue:Number(p.value ?? existing.proposalValue), proposalNo:p.proposalNo===undefined?existing.proposalNo:String(p.proposalNo||"")||null, updatedAt:new Date().toISOString() };
  const [lead]=await db.update(leads).set(values).where(eq(leads.enqNo,enqNo)).returning();
  return Response.json({lead});
}

export async function DELETE(request:Request){
  await ensureSchema(); await Promise.all([ensureFactoryDataSchema(),ensureTouchpointsSchema()]); const enqNo=new URL(request.url).searchParams.get("enqNo")?.trim();
  if(!enqNo) return Response.json({error:"Enquiry number is required."},{status:400});
  const deletedAt=new Date().toISOString();
  const results=await env.DB.batch([
    env.DB.prepare("DELETE FROM visit_forms WHERE enq_no = ?").bind(enqNo),
    env.DB.prepare("DELETE FROM proposal_documents WHERE enq_no = ?").bind(enqNo),
    env.DB.prepare("DELETE FROM travel_vouchers WHERE enq_no = ?").bind(enqNo),
    env.DB.prepare("DELETE FROM information_gathering WHERE enq_no = ?").bind(enqNo),
    env.DB.prepare("DELETE FROM factory_data WHERE enq_no = ?").bind(enqNo),
    env.DB.prepare("DELETE FROM touchpoints WHERE enq_no = ?").bind(enqNo),
    env.DB.prepare("UPDATE leads SET deleted_at = ?, updated_at = ? WHERE enq_no = ?").bind(deletedAt,deletedAt,enqNo),
  ]);
  return Response.json({deleted:true,enqNo,deletedVisitForms:Number(results[0]?.meta?.changes ?? 0),deletedProposals:Number(results[1]?.meta?.changes ?? 0),deletedTravelVouchers:Number(results[2]?.meta?.changes ?? 0),deletedInformationRecords:Number(results[3]?.meta?.changes ?? 0)});
}
