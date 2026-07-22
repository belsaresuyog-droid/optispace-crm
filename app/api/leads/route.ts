import { desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { leads } from "../../../db/schema";
import { env } from "cloudflare:workers";

const areaToSqft: Record<string, number> = { SqFt: 1, SqM: 10.7639104167, Acre: 43560, Guntha: 1089 };
const statusMap: Record<string, "LEAD_RECEIVED" | "ENGAGED" | "PROPOSAL_SENT" | "CONVERTED" | "ON_HOLD" | "STOP"> = { "Lead Received":"LEAD_RECEIVED", "Engagement Initiated":"ENGAGED", "Proposal Sent":"PROPOSAL_SENT", "Converted":"CONVERTED", "On Hold":"ON_HOLD", "STOP":"STOP" };
let schemaReady=false;
async function ensureSchema(){ if(schemaReady) return; await env.DB.prepare(`CREATE TABLE IF NOT EXISTS leads (enq_no text PRIMARY KEY NOT NULL, client_name text NOT NULL, company_name text NOT NULL, email text NOT NULL, phone text NOT NULL, city text DEFAULT '' NOT NULL, address text DEFAULT '' NOT NULL, website text DEFAULT '' NOT NULL, plot_area real DEFAULT 0 NOT NULL, built_up_area_sqft real NOT NULL, source_area_unit text DEFAULT 'SqFt' NOT NULL, operation_nature text DEFAULT '' NOT NULL, enquiry_source text NOT NULL, project_class text NOT NULL, status text DEFAULT 'LEAD_RECEIVED' NOT NULL, last_action text DEFAULT '' NOT NULL, next_action text DEFAULT '' NOT NULL, age_label text DEFAULT '' NOT NULL, proposal_value real DEFAULT 0 NOT NULL, proposal_no text, received_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at text)`).run(); try{await env.DB.prepare("ALTER TABLE leads ADD deleted_at text").run();}catch{} schemaReady=true; }

export async function GET() {
  await ensureSchema();
  const rows = await getDb().select().from(leads).where(isNull(leads.deletedAt)).orderBy(desc(leads.receivedAt)).limit(1000);
  return Response.json({ leads: rows });
}

export async function POST(request: Request) {
  await ensureSchema();
  const p = await request.json() as Record<string, string | number>;
  const email = String(p.email ?? "").trim(); const bua = Number(p.builtUpArea); const unit = String(p.areaUnit ?? "SqFt");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Primary email is invalid." }, { status: 400 });
  if (!(bua > 0)) return Response.json({ error: "Built-up area is required and must be greater than zero." }, { status: 400 });
  if (!areaToSqft[unit]) return Response.json({ error: "Area unit must be SqFt, SqM, Acre, or Guntha." }, { status: 400 });
  const db = getDb();
  const count = await db.select({ value: sql<number>`count(*)` }).from(leads);
  const enqNo = `E2627${String(Number(count[0]?.value ?? 0) + 1).padStart(3, "0")}`;
  const [lead] = await db.insert(leads).values({ enqNo, clientName: String(p.clientName ?? "").trim(), companyName: String(p.companyName ?? "").trim(), email, phone: String(p.phone ?? "").trim(), city: String(p.city ?? "").trim(), address: String(p.address ?? "").trim(), website:String(p.website ?? "").trim(), plotArea: Number(p.plotArea ?? 0), builtUpAreaSqft: Number((bua * areaToSqft[unit]).toFixed(2)), sourceAreaUnit: unit, operationNature: String(p.operationNature ?? "").trim(), enquirySource: String(p.enquirySource ?? "SMM"), projectClass: String(p.projectClass ?? "Greenfield"), status:statusMap[String(p.status)] || "LEAD_RECEIVED", lastAction:String(p.lastAction ?? "Lead received"), nextAction:String(p.nextAction ?? "Qualifying phone call"), ageLabel:String(p.age ?? "Just now"), proposalValue:Number(p.value ?? 0), proposalNo:String(p.proposalNo ?? "") || null }).returning();
  return Response.json({ lead }, { status: 201 });
}

export async function PATCH(request:Request){
  await ensureSchema();
  const p=await request.json() as Record<string,string|number>; const enqNo=String(p.enqNo ?? "").trim();
  if(!enqNo) return Response.json({error:"Enquiry number is required."},{status:400});
  const values={ enqNo, clientName:String(p.clientName ?? p.contact ?? "").trim(), companyName:String(p.companyName ?? p.company ?? "").trim(), email:String(p.email ?? "").trim(), phone:String(p.phone ?? "").trim(), city:String(p.city ?? "").trim(), address:String(p.address ?? ""), website:String(p.website ?? "").trim(), plotArea:Number(p.plotArea ?? 0), builtUpAreaSqft:Number(p.builtUpArea ?? p.bua ?? 0), sourceAreaUnit:"SqFt", operationNature:String(p.operationNature ?? ""), enquirySource:String(p.enquirySource ?? p.source ?? "Website"), projectClass:String(p.projectClass ?? p.project ?? "Greenfield"), status:statusMap[String(p.status)] || "LEAD_RECEIVED" as const, lastAction:String(p.lastAction ?? ""), nextAction:String(p.nextAction ?? ""), ageLabel:String(p.age ?? ""), proposalValue:Number(p.value ?? 0), proposalNo:String(p.proposalNo ?? "") || null, updatedAt:new Date().toISOString() };
  const [lead]=await getDb().insert(leads).values(values).onConflictDoUpdate({target:leads.enqNo,set:values}).returning();
  return Response.json({lead});
}

export async function DELETE(request:Request){
  await ensureSchema(); const enqNo=new URL(request.url).searchParams.get("enqNo")?.trim();
  if(!enqNo) return Response.json({error:"Enquiry number is required."},{status:400});
  await getDb().update(leads).set({deletedAt:new Date().toISOString(),updatedAt:new Date().toISOString()}).where(eq(leads.enqNo,enqNo));
  return Response.json({deleted:true,enqNo});
}
