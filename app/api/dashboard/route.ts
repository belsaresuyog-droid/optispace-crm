import { sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { leads, touchpoints } from "../../../db/schema";

export async function GET() {
  const db = getDb();
  const phases = await db.select({ status: leads.status, count: sql<number>`count(*)` }).from(leads).groupBy(leads.status);
  const priorities = await db.select({ enqNo: leads.enqNo, company: leads.companyName, contact: leads.clientName, phone: leads.phone, note: touchpoints.notes, scheduledAt: touchpoints.scheduledAt })
    .from(touchpoints).innerJoin(leads, sql`${touchpoints.enqNo} = ${leads.enqNo}`)
    .where(sql`(${touchpoints.scheduledAt} IS NOT NULL OR ${touchpoints.notes} LIKE '%Call scheduled for%') AND ${touchpoints.completed} = 0`)
    .orderBy(touchpoints.scheduledAt).limit(25);
  return Response.json({ phases, priorities, generatedAt: new Date().toISOString() });
}
