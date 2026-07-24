import { env } from "cloudflare:workers";

export async function GET() {
  const googleClientId = String(env.GOOGLE_CLIENT_ID || "");
  if (!googleClientId) {
    return Response.json(
      { error: "Google login is not configured yet." },
      { status: 503 },
    );
  }
  return Response.json({ googleClientId });
}

