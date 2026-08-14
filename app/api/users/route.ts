import { env } from "cloudflare:workers";
import { ensureAuthSchema, requireRequestUser } from "../../../lib/auth";

export async function GET(request: Request) {
  const auth = await requireRequestUser(request);
  if (auth.response) return auth.response;
  await ensureAuthSchema();
  const rows = await env.DB.prepare(
    "SELECT id, email, name, picture, role FROM users WHERE is_active=1 ORDER BY CASE WHEN name='' THEN email ELSE name END, email",
  ).all();
  const users = [...(rows.results as Array<Record<string,unknown>>)];
  if (auth.user && !users.some(user => Number(user.id) === auth.user?.id)) users.unshift(auth.user);
  return Response.json({ users, currentUserId: auth.user?.id });
}
