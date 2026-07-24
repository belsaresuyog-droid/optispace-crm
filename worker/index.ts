/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  GOOGLE_CLIENT_ID?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

function sessionToken(request: Request) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === "optispace_session") return decodeURIComponent(value.join("="));
  }
  return "";
}

async function authenticated(request: Request, env: Env) {
  const token = sessionToken(request);
  if (!token) return false;
  try {
    return Boolean(await env.DB.prepare(`SELECT 1 ok FROM auth_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token=? AND s.expires_at>CURRENT_TIMESTAMP AND u.is_active=1`).bind(token).first());
  } catch {
    return false;
  }
}

async function buildEodMessage(env: Env, now = new Date()) {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const label = now.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).replaceAll(" ", "-");
  const value = async (statement: string) => Number((await env.DB.prepare(statement).bind(today).first<{ count: number }>())?.count ?? 0);
  const [calls, videos, visits, proposals, invoices, advances] = await Promise.all([
    value("SELECT count(*) count FROM touchpoints WHERE type='PHONE' AND date(created_at)=?"),
    value("SELECT count(*) count FROM touchpoints WHERE type='VIDEO' AND completed=1 AND date(occurred_at)=?"),
    value("SELECT count(*) count FROM touchpoints WHERE type='SITE_VISIT' AND completed=1 AND date(occurred_at)=?"),
    value("SELECT count(*) count FROM proposals WHERE date(dispatched_at)=?"),
    value("SELECT count(*) count FROM invoices WHERE mode='PROFORMA' AND date(issued_at)=?"),
    value("SELECT count(*) count FROM payments WHERE date(received_at)=?"),
  ]);
  const phaseRows = await env.DB.prepare("SELECT status, count(*) count FROM leads GROUP BY status").all<{ status: string; count: number }>();
  const phases = Object.fromEntries(phaseRows.results.map(r => [r.status, Number(r.count)]));
  return `*Solutions Optispace CRM - Daily EOD Activity Report*\nDate: ${label}\n\n*1. Today's Work Progress*\n- Outbound Calls Logged: ${calls}\n- Video Pitches Conducted: ${videos}\n- Site Visits Completed: ${visits}\n- New Proposals Dispatched: ${proposals}\n- Proforma Invoices Issued: ${invoices}\n- Financial Advances Received: ${advances}\n\n*2. Live Dashboard Phase Summary*\n- Phase 1 (Leads Ingested): ${phases.LEAD_RECEIVED ?? 0}\n- Phase 2 (Engagement Initiated): ${phases.ENGAGED ?? 0}\n- Phase 3 (Proposals Outstanding): ${phases.PROPOSAL_SENT ?? 0}\n- Phase 4 (Converted Projects): ${phases.CONVERTED ?? 0}\n\n---\nGenerated automatically by Solutions Optispace System Engine at 6:00 PM.`;
}

async function sendWhatsAppEod(env: Env) {
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) throw new Error("WhatsApp Cloud API credentials are not configured.");
  const body = await buildEodMessage(env);
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
    try {
      const response = await fetch(`https://graph.facebook.com/v23.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { method: "POST", headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: "917666258956", type: "text", text: { preview_url: false, body } }) });
      if (response.ok) return;
      if (response.status < 500 && response.status !== 429) throw new Error(`WhatsApp rejected the report (${response.status}).`);
      lastError = new Error(`Temporary WhatsApp error (${response.status}).`);
    } catch (error) { lastError = error instanceof Error ? error : new Error("WhatsApp connection failed."); }
  }
  throw lastError ?? new Error("WhatsApp delivery failed after 3 attempts.");
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const publicPath = url.pathname === "/login" || url.pathname === "/api/auth/google" || url.pathname === "/api/auth/config" || url.pathname.startsWith("/_next/") || url.pathname.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(url.pathname);
    const signedIn = publicPath && url.pathname !== "/login" ? false : await authenticated(request, env);
    if (!publicPath && !signedIn) {
      if (url.pathname.startsWith("/api/")) return Response.json({ error: "Authentication required." }, { status: 401 });
      return Response.redirect(new URL("/login", request.url), 302);
    }
    if (url.pathname === "/login" && signedIn) return Response.redirect(new URL("/", request.url), 302);

    return handler.fetch(request, env, ctx);
  },
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Configure the platform cron as `30 12 * * *` (18:00 Asia/Kolkata).
    ctx.waitUntil(sendWhatsAppEod(env));
  },
};

export default worker;
