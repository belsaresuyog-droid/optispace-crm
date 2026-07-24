import { getRequestUser } from "../../../../lib/auth";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  return Response.json({ user });
}

