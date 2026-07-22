import { buildIntelligence } from "../../../../lib/intelligence";
import { researchCompany } from "../../../../lib/company-research";
export async function POST(request:Request){ const input=await request.json(); const research=await researchCompany(input); return Response.json(buildIntelligence(input,research)); }
