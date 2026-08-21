import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { leads, touchpoints } from "../../../db/schema";

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS touchpoints (
    id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    enq_no text NOT NULL,
    type text NOT NULL,
    sequence_no integer,
    scheduled_at text,
    occurred_at text,
    completed integer DEFAULT false NOT NULL,
    travel_voucher_shared integer DEFAULT false NOT NULL,
    notes text DEFAULT '' NOT NULL,
    created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (enq_no) REFERENCES leads(enq_no)
  )`).run();
  schemaReady = true;
}

export async function GET(request: Request) {
  await ensureSchema();
  const enqNo = new URL(request.url).searchParams.get("enqNo")?.trim();
  if (!enqNo) return Response.json({ error: "Enquiry number is required." }, { status: 400 });
  const rows = await getDb().select().from(touchpoints).where(eq(touchpoints.enqNo, enqNo)).orderBy(desc(touchpoints.occurredAt), desc(touchpoints.createdAt), desc(touchpoints.id)).limit(250);
  return Response.json({ touchpoints: rows });
}

export async function POST(request: Request) {
  await ensureSchema();
  const p = await request.json() as Record<string, string | number>;
  const enqNo = String(p.enqNo ?? "").trim();
  const notes = String(p.notes ?? "").trim();
  if (!enqNo || !notes) return Response.json({ error: "Enquiry number and notes are required." }, { status: 400 });
  const existingLead = await getDb().select({ enqNo: leads.enqNo }).from(leads).where(and(eq(leads.enqNo, enqNo), isNull(leads.deletedAt))).limit(1);
  if (!existingLead.length) return Response.json({ error: "Lead was not found." }, { status: 404 });
  const count = await getDb().select({ value: sql<number>`count(*)` }).from(touchpoints).where(eq(touchpoints.enqNo, enqNo));
  const allowed = ["PHONE", "VIDEO", "SITE_VISIT", "EMAIL", "NOTE"];
  const type = allowed.includes(String(p.type)) ? String(p.type) as "PHONE" | "VIDEO" | "SITE_VISIT" | "EMAIL" | "NOTE" : "NOTE";
  const scheduledAt = String(p.scheduledAt ?? "") || null;
  const duplicate = await env.DB.prepare(`SELECT id FROM touchpoints
    WHERE enq_no=? AND type=? AND notes=? AND COALESCE(scheduled_at,'')=COALESCE(?,'')
      AND datetime(created_at) >= datetime('now','-30 seconds')
    ORDER BY id DESC LIMIT 1`).bind(enqNo,type,notes,scheduledAt).first();
  if (duplicate) return Response.json({ touchpoint: duplicate, duplicate: true });
  const [touchpoint] = await getDb().insert(touchpoints).values({
    enqNo,
    type,
    sequenceNo: Number(count[0]?.value ?? 0) + 1,
    occurredAt: String(p.occurredAt ?? new Date().toISOString()),
    scheduledAt,
    completed: true,
    notes,
  }).returning();
  return Response.json({ touchpoint }, { status: 201 });
}

export async function PATCH(request:Request){
  await ensureSchema();
  const body=await request.json() as {id?:number;notes?:string};
  const id=Number(body.id),notes=String(body.notes||"").trim();
  if(!id||!notes)return Response.json({error:"Touchpoint id and activity details are required."},{status:400});
  const touchpoint=await env.DB.prepare("UPDATE touchpoints SET notes=? WHERE id=? RETURNING id,enq_no enqNo,type,sequence_no sequenceNo,scheduled_at scheduledAt,occurred_at occurredAt,completed,notes,created_at createdAt").bind(notes,id).first();
  if(!touchpoint)return Response.json({error:"Timeline record was not found."},{status:404});
  return Response.json({touchpoint});
}

export async function DELETE(request:Request){
  await ensureSchema();
  const id=Number(new URL(request.url).searchParams.get("id"));
  if(!id)return Response.json({error:"Activity record id is required."},{status:400});
  const deleted=await env.DB.prepare("DELETE FROM touchpoints WHERE id=?").bind(id).run();
  if(!Number(deleted.meta?.changes||0))return Response.json({error:"Activity record was not found."},{status:404});
  return Response.json({deleted:true,id});
}
