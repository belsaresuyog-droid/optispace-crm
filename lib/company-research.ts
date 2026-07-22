export type ResearchSource = {
  title: string;
  url: string;
  snippet: string;
  category: "open_knowledge" | "open_news" | "web_search" | "company_source";
  provider: string;
  retrievedAt: string;
};

export type CompanyResearch = {
  status: "completed" | "partial" | "failed";
  provider: string;
  queries: string[];
  portalsSearched: Array<{ portal: string; status: "searched" | "unavailable" | "not_configured" | "not_applicable"; records: number; url: string }>;
  sources: ResearchSource[];
  findings: {
    turnoverMentions: string[];
    employeeMentions: string[];
    foundedMentions: string[];
    professionalHighlights: string[];
    productDetails: string[];
    officialWebsite: string | null;
    profileSummary: string;
  };
  message: string;
};

const retrievedAt = () => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  timeZone: "Asia/Kolkata"
}).format(new Date()).replace("AM", "am").replace("PM", "pm");

const plain = (value = "") => value.replace(/<[^>]*>/g, " ").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
const mentions = (text: string, pattern: RegExp) => unique([...text.matchAll(pattern)].map((match) => match[0]).slice(0, 6));
const companyKey = (value: string) => value.toLowerCase().replace(/\b(private|pvt|limited|ltd|llp|incorporated|inc|corporation|corp|company|co)\b/g, "").replace(/[^a-z0-9]/g, "");

async function wikipedia(company: string): Promise<ResearchSource[]> {
  const params = new URLSearchParams({ action: "query", list: "search", srsearch: `"${company}" company`, srlimit: "5", srnamespace: "0", format: "json", origin: "*" });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { headers: { "User-Agent": "SolutionsOptispaceCRM/1.0" } });
  if (!response.ok) throw new Error("Wikipedia unavailable");
  const data = await response.json() as { query?: { search?: Array<{ title: string; snippet: string }> } };
  return (data.query?.search || []).map((item) => ({ title: item.title, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`, snippet: plain(item.snippet), category: "open_knowledge", provider: "Wikipedia", retrievedAt: retrievedAt() }));
}

async function googleDiscovery(input:{company:string;city?:string}) {
  const key=process.env.GOOGLE_SEARCH_API_KEY?.trim(), cx=process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();
  if(!key || !cx) return {configured:false,sources:[] as ResearchSource[],officialWebsites:[] as string[]};
  const queries=[`"${input.company}" ${input.city || "India"} official website products services`,`"${input.company}" turnover revenue employees plant`,`"${input.company}" founder director management`];
  const batches=await Promise.all(queries.map(async(q)=>{const params=new URLSearchParams({key,cx,q,num:"10",gl:"in",safe:"active"});const response=await fetch(`https://customsearch.googleapis.com/customsearch/v1?${params}`);if(!response.ok)throw new Error(`Google search returned ${response.status}`);const data=await response.json() as {items?:Array<{title?:string;link?:string;snippet?:string}>};return (data.items || []).map(item=>({title:plain(item.title),url:item.link || "",snippet:plain(item.snippet),category:"web_search" as const,provider:"Google Programmable Search",retrievedAt:retrievedAt()})).filter(item=>item.url.startsWith("https://"));}));
  const sources=[...new Map(batches.flat().map(source=>[source.url,source])).values()];
  const blocked=/wikipedia|wikidata|linkedin|facebook|instagram|youtube|indiamart|justdial|zaubacorp|thecompanycheck|tofler/i;
  const officialWebsites=sources.filter(source=>!blocked.test(new URL(source.url).hostname)).map(source=>{const url=new URL(source.url);return `${url.protocol}//${url.hostname}/`;}).slice(0,3);
  return {configured:true,sources,officialWebsites};
}

async function wikidata(company: string): Promise<{ sources: ResearchSource[]; officialWebsites: string[] }> {
  const params = new URLSearchParams({ action: "wbsearchentities", search: company, language: "en", uselang: "en", type: "item", limit: "5", format: "json", origin: "*" });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${params}`, { headers: { "User-Agent": "SolutionsOptispaceCRM/1.0" } });
  if (!response.ok) throw new Error("Wikidata unavailable");
  const data = await response.json() as { search?: Array<{ id: string; label: string; description?: string }> };
  const matches = data.search || [];
  const sources: ResearchSource[] = matches.map((item) => ({ title: `${item.label} (${item.id})`, url: `https://www.wikidata.org/wiki/${item.id}`, snippet: plain(item.description || "Wikidata entity; confirm that it matches the selected company."), category: "open_knowledge", provider: "Wikidata", retrievedAt: retrievedAt() }));
  const normalized = companyKey(company);
  const exact = matches.find((item) => companyKey(item.label) === normalized);
  if (!exact) return { sources, officialWebsites: [] };
  const entityResponse = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${exact.id}.json`, { headers: { "User-Agent": "SolutionsOptispaceCRM/1.0" } });
  if (!entityResponse.ok) return { sources, officialWebsites: [] };
  const entityData = await entityResponse.json() as { entities?: Record<string, { claims?: { P856?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }> };
  const officialWebsites = (entityData.entities?.[exact.id]?.claims?.P856 || []).map((claim) => claim.mainsnak?.datavalue?.value || "").filter(Boolean);
  return { sources, officialWebsites };
}

async function gdelt(company: string): Promise<ResearchSource[]> {
  const params = new URLSearchParams({ query: `"${company}"`, mode: "ArtList", maxrecords: "10", format: "json", sort: "HybridRel" });
  const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`);
  if (!response.ok) throw new Error("GDELT unavailable");
  const data = await response.json() as { articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }> };
  return (data.articles || []).filter((item) => item.url && item.title).map((item) => ({ title: plain(item.title), url: item.url!, snippet: `Public news-index result from ${item.domain || "source publication"}${item.seendate ? ` · indexed ${item.seendate}` : ""}.`, category: "open_news", provider: "GDELT", retrievedAt: retrievedAt() }));
}

function safePublicUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    return url;
  } catch { return null; }
}

async function suppliedCompanyPage(value?: string): Promise<ResearchSource[]> {
  const url = safePublicUrl(value);
  if (!url) return [];
  const response = await fetch(url, { redirect: "follow", headers: { "User-Agent": "SolutionsOptispaceCRM/1.0" } });
  if (!response.ok) throw new Error("Company source unavailable");
  const html = (await response.text()).slice(0, 250_000);
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || url.hostname);
  const description = plain(html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)/i)?.[1] || html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").slice(0, 1200));
  const home: ResearchSource = { title, url: url.toString(), snippet: description.slice(0, 700), category: "company_source", provider: "Official company website", retrievedAt: retrievedAt() };
  const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const candidates = [...html.matchAll(linkPattern)].map((match) => ({ href: match[1], label: plain(match[2]) })).filter((link) => /products?|services?|solutions?|capabilit|portfolio|industries/i.test(`${link.label} ${link.href}`));
  const productUrls = unique(candidates.map((link) => { try { const candidate = new URL(link.href, url); return candidate.hostname === url.hostname && candidate.protocol === "https:" ? candidate.toString() : ""; } catch { return ""; } })).slice(0, 5);
  const pages = await Promise.allSettled(productUrls.map(async (productUrl) => {
    const pageResponse = await fetch(productUrl, { redirect: "follow", headers: { "User-Agent": "SolutionsOptispaceCRM/1.0" } });
    if (!pageResponse.ok) throw new Error("Product page unavailable");
    const pageHtml = (await pageResponse.text()).slice(0, 250_000).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
    const pageTitle = plain(pageHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || productUrl);
    const headings = unique([...pageHtml.matchAll(/<(?:h1|h2|h3|li)[^>]*>([\s\S]*?)<\/(?:h1|h2|h3|li)>/gi)].map((match) => plain(match[1])).filter((text) => text.length >= 3 && text.length <= 160)).slice(0, 30);
    return { title: pageTitle, url: productUrl, snippet: headings.join(" · ").slice(0, 1400), category: "company_source" as const, provider: "Official product/service page", retrievedAt: retrievedAt() };
  }));
  return [home, ...pages.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])];
}

export async function researchCompany(input: { company: string; city?: string; contact?: string; verifiedSourceUrl?: string }): Promise<CompanyResearch> {
  const googleResult = await googleDiscovery(input).catch(() => ({configured:true,sources:[] as ResearchSource[],officialWebsites:[] as string[]}));
  const wikidataResult = await wikidata(input.company).catch(() => ({ sources: [] as ResearchSource[], officialWebsites: [] as string[] }));
  const discoveredWebsite = safePublicUrl(wikidataResult.officialWebsites[0])?.toString();
  const googleWebsite=safePublicUrl(googleResult.officialWebsites[0])?.toString();
  const officialWebsite = safePublicUrl(input.verifiedSourceUrl)?.toString() || googleWebsite || discoveredWebsite;
  const queries = [`Google: ${input.company} company, products, turnover and leadership`,`Wikipedia: ${input.company}`, `Wikidata: ${input.company}`, `GDELT: "${input.company}"`, ...(officialWebsite ? [`Official website: ${officialWebsite}`] : [])];
  const settled = await Promise.allSettled([Promise.resolve(googleResult.sources),wikipedia(input.company), Promise.resolve(wikidataResult.sources), gdelt(input.company), suppliedCompanyPage(officialWebsite)]);
  const sources = [...new Map(settled.flatMap((result) => result.status === "fulfilled" ? result.value : []).map((source) => [source.url, source])).values()].slice(0, 20);
  const normalizedCompany = companyKey(input.company);
  const exactSources = sources.filter((source) => companyKey(source.title.replace(/\s*\(Q\d+\)$/, "")) === normalizedCompany || source.category === "company_source");
  const corpus = exactSources.map((source) => `${source.title}. ${source.snippet}`).join(" ");
  const failures = settled.filter((result) => result.status === "rejected").length;
  const portalNames = [
    { portal: "Google Programmable Search", url: "https://programmablesearchengine.google.com/" },
    { portal: "Wikipedia", url: "https://en.wikipedia.org/" },
    { portal: "Wikidata", url: "https://www.wikidata.org/" },
    { portal: "GDELT", url: "https://www.gdeltproject.org/" },
    { portal: "Official company website", url: officialWebsite || "" }
  ];
  const portalsSearched = portalNames.map((portal, index) => ({
    ...portal,
    status: index === 0 && !googleResult.configured ? "not_configured" as const : index === 4 && !officialWebsite ? "not_applicable" as const : settled[index]?.status === "fulfilled" ? "searched" as const : "unavailable" as const,
    records: settled[index]?.status === "fulfilled" ? settled[index].value.length : 0
  }));
  const professionalHighlights = exactSources.filter((source) => /founder|director|owner|chief executive|managing director/i.test(source.snippet)).map((source) => source.snippet).slice(0, 4);
  return {
    status: sources.length ? (failures ? "partial" : "completed") : "failed",
    provider: "Google discovery, Wikipedia, Wikidata, GDELT and official company website",
    queries,
    portalsSearched,
    sources,
    findings: {
      turnoverMentions: mentions(corpus, /(?:turnover|revenue|sales)[^.]{0,80}(?:₹|Rs\.?|INR)?\s?[\d,.]+\s?(?:crore|cr|lakh|million|billion)?/gi),
      employeeMentions: mentions(corpus, /(?:employees?|workforce|team)[^.]{0,50}\d[\d,]*(?:\+)?/gi),
      foundedMentions: mentions(corpus, /(?:founded|established|incorporated)[^.]{0,40}(?:19|20)\d{2}/gi),
      professionalHighlights,
      productDetails: (() => { const pages = exactSources.filter((source) => source.provider === "Official product/service page").map((source) => source.snippet).filter(Boolean); return pages.length ? pages : exactSources.filter((source) => source.provider === "Official company website").map((source) => source.snippet).filter(Boolean); })(),
      officialWebsite: officialWebsite || null,
      profileSummary: sources.length ? `${sources.length} open-source records collected. Verify entity matches and material facts before proposal use.` : "No matching open-source record was found."
    },
    message: sources.length ? `Automatic open-source research collected ${sources.length} records${failures ? "; one or more providers were unavailable" : ""}.${officialWebsite ? ` Company portal searched: ${officialWebsite}` : " Warning: no company portal is available; intelligence continued with other open sources."}` : `Open-source providers returned no usable company records.${officialWebsite ? ` Company portal searched: ${officialWebsite}` : " Warning: no company portal is available; intelligence still completed without website data."}`
  };
}
