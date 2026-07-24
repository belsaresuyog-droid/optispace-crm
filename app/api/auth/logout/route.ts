import { clearedSessionCookie, deleteSession } from "../../../../lib/auth";

export async function POST(request: Request) {
  await deleteSession(request);
  return Response.json({ loggedOut: true }, { headers: { "Set-Cookie": clearedSessionCookie } });
}

