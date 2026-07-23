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
  const [touchpoint] = await getDb().insert(touchpoints).values({
    enqNo,
    type,
    sequenceNo: Number(count[0]?.value ?? 0) + 1,
    occurredAt: String(p.occurredAt ?? new Date().toISOString()),
    scheduledAt: String(p.scheduledAt ?? "") || null,
    completed: true,
    notes,
  }).returning();
  return Response.json({ touchpoint }, { status: 201 });
}
