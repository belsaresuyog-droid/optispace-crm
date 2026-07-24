import { env } from "cloudflare:workers";

let ready = false;

async function ensureSchema() {
  if (ready) return;
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
    updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (proposal_id) REFERENCES proposal_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (enq_no) REFERENCES leads(enq_no)
  )`).run();
  try { await env.DB.prepare("ALTER TABLE proposal_negotiations ADD scope_json text DEFAULT '{}' NOT NULL").run(); } catch {}
  try { await env.DB.prepare("ALTER TABLE proposal_negotiations ADD travel_json text DEFAULT '{}' NOT NULL").run(); } catch {}
  ready = true;
}

export async function GET(request: Request) {
  await ensureSchema();
  const proposalId = Number(new URL(request.url).searchParams.get("proposalId"));
  if (!proposalId) {
    const rows = await env.DB.prepare(`SELECT id,proposal_id proposalId,enq_no enqNo,
      original_area originalArea,negotiated_area negotiatedArea,
      original_proposal_value originalProposalValue,negotiated_proposal_value negotiatedProposalValue,
      original_travel_value originalTravelValue,negotiated_travel_value negotiatedTravelValue,
      scope_json scopeJson,travel_json travelJson,notes,created_at createdAt,updated_at updatedAt
      FROM proposal_negotiations ORDER BY updated_at DESC,id DESC`).all();
    return Response.json({ negotiations: rows.results.map((row:any)=>({...row,scope:JSON.parse(String(row.scopeJson||"{}")),travel:JSON.parse(String(row.travelJson||"{}"))})) });
  }
  const negotiation = await env.DB.prepare(`SELECT id,proposal_id proposalId,enq_no enqNo,
    original_area originalArea,negotiated_area negotiatedArea,
    original_proposal_value originalProposalValue,negotiated_proposal_value negotiatedProposalValue,
    original_travel_value originalTravelValue,negotiated_travel_value negotiatedTravelValue,
    scope_json scopeJson,travel_json travelJson,notes,created_at createdAt,updated_at updatedAt
    FROM proposal_negotiations WHERE proposal_id=?`).bind(proposalId).first();
  return Response.json({ negotiation: negotiation ? {...negotiation,scope:JSON.parse(String((negotiation as any).scopeJson||"{}")),travel:JSON.parse(String((negotiation as any).travelJson||"{}"))} : null });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json() as Record<string, unknown>;
  const proposalId = Number(body.proposalId);
  const enqNo = String(body.enqNo || "").trim();
  const originalArea = Math.max(0, Number(body.originalArea) || 0);
  const negotiatedArea = Math.max(0, Number(body.negotiatedArea) || 0);
  const originalProposalValue = Math.max(0, Number(body.originalProposalValue) || 0);
  const negotiatedProposalValue = Math.max(0, Number(body.negotiatedProposalValue) || 0);
  const originalTravelValue = Math.max(0, Number(body.originalTravelValue) || 0);
  const negotiatedTravelValue = Math.max(0, Number(body.negotiatedTravelValue) || 0);
  const scope = body.scope && typeof body.scope === "object" ? body.scope : {};
  const travel = body.travel && typeof body.travel === "object" ? body.travel : {};
  const notes = String(body.notes || "").trim();
  if (!proposalId || !enqNo) return Response.json({ error: "Proposal and lead are required." }, { status: 400 });
  const proposal = await env.DB.prepare("SELECT id FROM proposal_documents WHERE id=? AND enq_no=?").bind(proposalId, enqNo).first();
  if (!proposal) return Response.json({ error: "Linked proposal was not found." }, { status: 404 });
  await env.DB.prepare(`INSERT INTO proposal_negotiations (
    proposal_id,enq_no,original_area,negotiated_area,original_proposal_value,
    negotiated_proposal_value,original_travel_value,negotiated_travel_value,scope_json,travel_json,notes
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(proposal_id) DO UPDATE SET
    negotiated_area=excluded.negotiated_area,
    negotiated_proposal_value=excluded.negotiated_proposal_value,
    negotiated_travel_value=excluded.negotiated_travel_value,
    scope_json=excluded.scope_json,
    travel_json=excluded.travel_json,
    notes=excluded.notes,
    updated_at=CURRENT_TIMESTAMP`).bind(
      proposalId,enqNo,originalArea,negotiatedArea,originalProposalValue,
      negotiatedProposalValue,originalTravelValue,negotiatedTravelValue,JSON.stringify(scope),JSON.stringify(travel),notes,
    ).run();
  return Response.json({ saved: true, proposalId });
}
