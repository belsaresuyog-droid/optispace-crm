import { desc, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { leads } from "../../../db/schema";

const areaToSqft: Record<string, number> = { SqFt: 1, SqM: 10.7639104167, Acre: 43560, Guntha: 1089 };

export async function GET() {
  const rows = await getDb().select().from(leads).orderBy(desc(leads.receivedAt)).limit(250);
  return Response.json({ leads: rows });
}

export async function POST(request: Request) {
  const p = await request.json() as Record<string, string | number>;
  const email = String(p.email ?? "").trim(); const bua = Number(p.builtUpArea); const unit = String(p.areaUnit ?? "SqFt");
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "A valid primary email is required." }, { status: 400 });
  if (!(bua > 0)) return Response.json({ error: "Built-up area is required and must be greater than zero." }, { status: 400 });
  if (!areaToSqft[unit]) return Response.json({ error: "Area unit must be SqFt, SqM, Acre, or Guntha." }, { status: 400 });
  const db = getDb();
  const count = await db.select({ value: sql<number>`count(*)` }).from(leads);
  const enqNo = `E2627${String(Number(count[0]?.value ?? 0) + 1).padStart(3, "0")}`;
  const [lead] = await db.insert(leads).values({ enqNo, clientName: String(p.clientName ?? "").trim(), companyName: String(p.companyName ?? "").trim(), email, phone: String(p.phone ?? "").trim(), city: String(p.city ?? "").trim(), address: String(p.address ?? "").trim(), plotArea: Number(p.plotArea ?? 0), builtUpAreaSqft: Number((bua * areaToSqft[unit]).toFixed(2)), sourceAreaUnit: unit, operationNature: String(p.operationNature ?? "").trim(), enquirySource: String(p.enquirySource ?? "SMM"), projectClass: String(p.projectClass ?? "Greenfield") }).returning();
  return Response.json({ lead }, { status: 201 });
}
