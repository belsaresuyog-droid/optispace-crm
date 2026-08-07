import { env } from "cloudflare:workers";
import { requireRequestUser } from "../../../lib/auth";

export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;
  const rows = await env.DB.prepare(
    "SELECT id, email, name, picture, role FROM users WHERE is_active=1 ORDER BY CASE WHEN name='' THEN email ELSE name END, email",
  ).all();
  return Response.json({ users: rows.results, currentUserId: auth.user?.id });
}
