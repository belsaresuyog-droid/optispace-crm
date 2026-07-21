"use client";

import { FormEvent, useMemo, useState } from "react";
import { importedLeads, importMetadata } from "./imported-leads";

type Lead = {
  enq: string; company: string; contact: string; phone: string; city: string;
  project: string; bua: number; source: string; status: "Lead Received" | "Engagement Initiated" | "Proposal Sent" | "Converted" | "On Hold" | "STOP";
  lastAction: string; nextAction: string; age: string; value: number;
};

const seedLeads: Lead[] = importedLeads.map(lead => ({ ...lead, status: lead.status as Lead["status"] }));

const nav = ["Dashboard", "Leads", "Visit Form", "Proposals", "Invoices", "Email Center", "Reports"];
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);

function Mark({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? "compact" : ""}`}><span className="brand-symbol">◇</span><span><b>SOLUTIONS</b><strong>optispace</strong></span></div>;
}

function Status({ value }: { value: Lead["status"] }) {
  return <span className={`status ${value.toLowerCase().replaceAll(" ", "-")}`}>{value === "STOP" ? "STOP · Under 5,000 SqFt" : value}</span>;
}

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState(seedLeads);
  const [drawer, setDrawer] = useState<"lead" | "visit" | "invoice" | "proposal" | null>(null);
  const [selected, setSelected] = useState(seedLeads[0]);
  const [notice, setNotice] = useState("");
  const [rate, setRate] = useState(180);
  const [area, setArea] = useState(42000);
  const [invoiceMode, setInvoiceMode] = useState<"Proforma" | "Tax">("Proforma");
  const [stakeholders, setStakeholders] = useState([{ name: "", designation: "", mobile: "" }]);

  const filtered = useMemo(() => leads.filter(l => `${l.enq} ${l.company} ${l.contact} ${l.city}`.toLowerCase().includes(query.toLowerCase())), [leads, query]);
  const counts = {
    lead: leads.filter(l => l.status === "Lead Received").length,
    engaged: leads.filter(l => l.status === "Engagement Initiated").length,
    proposal: leads.filter(l => l.status === "Proposal Sent").length,
    converted: leads.filter(l => l.status === "Converted").length,
    hold: leads.filter(l => l.status === "On Hold").length,
    stop: leads.filter(l => l.status === "STOP").length,
  };
  const basic = area * rate; const gst = basic * 0.18; const total = basic + gst;

  function toast(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 3200); }
  function addLead(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const fd = new FormData(e.currentTarget); const bua = Number(fd.get("bua")); const email = String(fd.get("email") || "");
    if (!bua || !email) { toast("BUA and primary email are required."); return; }
    const company = String(fd.get("company"));
    setLeads(v => [{ enq: `E2627${String(v.length + 1).padStart(3, "0")}`, company, contact: String(fd.get("contact")), phone: String(fd.get("phone")), city: String(fd.get("city")), project: String(fd.get("project")), bua, source: String(fd.get("source")), status: "Lead Received", lastAction: "Lead received · Just now", nextAction: "Qualifying phone call", age: "now", value: bua * 180 }, ...v]);
    setDrawer(null); toast(`${company} was added to the lead inventory.`);
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <Mark />
      <div className="workspace"><small>WORKSPACE</small><b>Optispace CRM</b><span>FY 2026–27</span></div>
      <nav>{nav.map(item => <button className={active === item ? "active" : ""} key={item} onClick={() => { setActive(item); if (item === "Visit Form") setDrawer("visit"); if (item === "Invoices") setDrawer("invoice"); if (item === "Proposals") setDrawer("proposal"); }}><i>{["▦","◎","▤","◫","₹","✉","◒"][nav.indexOf(item)]}</i>{item}{item === "Email Center" && <em>3</em>}</button>)}</nav>
      <div className="sidebar-foot"><div className="avatar">MU</div><span><b>Minish Umrani</b><small>Administrator</small></span><button aria-label="Settings">•••</button></div>
    </aside>

    <section className="content">
      <header className="topbar"><div><p>Tuesday, 21 July 2026</p><h1>Good morning, Minish.</h1></div><div className="top-actions"><label className="search"><span>⌕</span><input aria-label="Search leads" placeholder="Search enquiry, company, contact…" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="icon-button" aria-label="Notifications">♢<span /></button><button className="primary" onClick={() => setDrawer("lead")}>＋ Add lead</button></div></header>

      <div className="import-banner"><span>✓</span><div><b>{importMetadata.total} current leads imported</b><small>{importMetadata.source} · Synced {importMetadata.importedOn}</small></div><div><em>{counts.hold} on hold</em><em className="stop-count">{counts.stop} stopped</em></div></div>

      <section className="phase-grid">
        {[
          ["01", "Lead received", counts.lead, "Awaiting first engagement", "+2 this week"],
          ["02", "Engagement initiated", counts.engaged, "Video call or site visit", "+4 this week"],
          ["03", "Proposal sent", counts.proposal, "Commercial decision pending", `${counts.proposal} proposals outstanding`],
          ["04", "Lead converted", counts.converted, "Advance / PI fulfilled", `${((counts.converted / leads.length) * 100).toFixed(1)}% conversion`],
        ].map((p, i) => <article className={`phase-card p${i + 1}`} key={p[0]}><div className="phase-head"><span>PHASE {p[0]}</span><i>{i === 3 ? "✓" : "→"}</i></div><strong>{p[2]}</strong><h2>{p[1]}</h2><p>{p[3]}</p><footer><span>{p[4]}</span><b>{i === 3 ? "▲" : "↗"}</b></footer></article>)}
      </section>

      <section className="work-grid">
        <article className="panel priorities">
          <div className="panel-head"><div><span className="eyebrow">08:00 AM DAILY QUEUE</span><h2>Today’s priority actions</h2></div><button>View all 12 →</button></div>
          {leads.filter(l => l.status === "Proposal Sent").slice(0, 1).map(l => <div className="priority-row urgent" key={l.enq}><span className="priority-no">01</span><div className="priority-main"><span className="pill">PROPOSAL FOLLOW-UP</span><h3>{l.company}</h3><p>{l.enq} · {l.contact} · {l.phone}</p><b>{l.lastAction}</b></div><button onClick={() => toast(`Follow-up opened for ${l.enq}`)}>Follow up</button></div>)}
          {leads.filter(l => l.status === "Engagement Initiated").slice(0, 1).map(l => <div className="priority-row" key={l.enq}><span className="priority-no">02</span><div className="priority-main"><span className="pill amber">ENGAGEMENT FOLLOW-UP</span><h3>{l.company}</h3><p>{l.enq} · {l.contact} · {l.phone}</p><b>{l.lastAction}</b></div><button onClick={() => toast(`Activity opened for ${l.enq}`)}>Log action</button></div>)}
          {leads.filter(l => l.status === "On Hold").slice(0, 1).map(l => <div className="priority-row" key={l.enq}><span className="priority-no">03</span><div className="priority-main"><span className="pill slate">HOLD REVIEW</span><h3>{l.company}</h3><p>{l.enq} · {l.contact}</p><b>{l.lastAction}</b></div><button onClick={() => toast(`Email draft queued for ${l.enq}`)}>Draft email</button></div>)}
        </article>

        <aside className="panel activity">
          <div className="panel-head"><div><span className="eyebrow">LIVE LOG</span><h2>Recent activity</h2></div><button>•••</button></div>
          {[ ["₹", "Advance received", "Vertex Packaging", "₹9,82,350 · 28m", "green"], ["⌂", "Site visit completed", "Pragati Foods Pvt. Ltd.", "Visit 01 · 1h", "blue"], ["▤", "Proposal dispatched", "Aarav Auto Components", "2627P022 · 2h", "amber"], ["☎", "Phone call logged", "Kinetic Sheet Metals", "12 min · 3h", "slate"] ].map(a => <div className="activity-item" key={a[1]}><i className={a[4]}>{a[0]}</i><span><b>{a[1]}</b><p>{a[2]}</p><small>{a[3]}</small></span></div>)}
          <button className="full-link">Open activity log →</button>
        </aside>
      </section>

      <section className="panel pipeline">
        <div className="panel-head pipeline-head"><div><span className="eyebrow">LEAD MASTER · EXCEL SYNC</span><h2>Current pipeline</h2></div><div className="filters"><button className="selected">All leads <b>{leads.length}</b></button><button>On hold <b>{counts.hold}</b></button><button>Converted <b>{counts.converted}</b></button><button>▾ Filter</button></div></div>
        <div className="table-wrap"><table><thead><tr><th>ENQUIRY</th><th>ACCOUNT / CONTACT</th><th>PROJECT</th><th>BUA</th><th>STATUS</th><th>LAST ACTION</th><th>NEXT ACTION</th><th /></tr></thead><tbody>{filtered.map(l => <tr className={l.status === "Converted" ? "row-converted" : l.status === "STOP" ? "row-stop" : ""} key={l.enq}><td><b>{l.enq}</b><small>{l.city} · {l.source}</small></td><td><strong>{l.company}</strong><small>{l.contact} · {l.phone}</small></td><td>{l.project}</td><td>{l.bua.toLocaleString("en-IN")} <small>SqFt</small></td><td><Status value={l.status} /></td><td>{l.lastAction}<small>{l.age} ago</small></td><td>{l.nextAction}</td><td><button aria-label={`Open ${l.enq}`} onClick={() => { setSelected(l); setDrawer("proposal"); }}>›</button></td></tr>)}</tbody></table></div>
        <footer className="table-foot"><span>Showing {filtered.length} of {leads.length} leads</span><div><button>‹</button><button className="current">1</button><button>2</button><button>3</button><button>›</button></div></footer>
      </section>
    </section>

    {drawer && <div className="overlay" role="dialog" aria-modal="true" aria-label={`${drawer} panel`}><div className="drawer">
      <header><div><span className="eyebrow">SOLUTIONS OPTISPACE</span><h2>{drawer === "lead" ? "Create new lead" : drawer === "visit" ? "Form No. 2 — Visit 01" : drawer === "invoice" ? `${invoiceMode} Invoice` : "Lean Factory Building Proposal"}</h2><p>{drawer === "visit" ? "Interactive first-visit discovery record" : drawer === "invoice" ? "Commercial document calculator" : drawer === "proposal" ? `${selected.enq} · ${selected.company}` : "Qualify and add an opportunity to the pipeline"}</p></div><button className="close" onClick={() => setDrawer(null)}>×</button></header>

      {drawer === "lead" && <form onSubmit={addLead} className="form-body"><div className="section-title"><span>01</span><div><b>Client information</b><small>Primary account and contact details</small></div></div><div className="form-grid"><label>Company name *<input name="company" required placeholder="e.g. Apex Manufacturing" /></label><label>Contact person *<input name="contact" required placeholder="Full name" /></label><label>Primary email *<input name="email" type="email" placeholder="name@company.com" /></label><label>Phone number *<input name="phone" required placeholder="+91" /></label><label>City<input name="city" placeholder="Pune" /></label><label>Project class<select name="project"><option>Greenfield</option><option>Light Greenfield</option><option>Hybrid</option><option>Brownfield</option><option>Turnkey</option></select></label><label>Built-up area (SqFt) *<input name="bua" type="number" min="1" placeholder="25000" /></label><label>Enquiry source<select name="source"><option>SMM</option><option>WOM</option><option>Reference</option><option>Kaka Enq</option></select></label></div><div className="drawer-actions"><button type="button" onClick={() => setDrawer(null)}>Cancel</button><button className="primary" type="submit">Create lead</button></div></form>}

      {drawer === "visit" && <div className="form-body visit-form"><div className="section-title"><span>01</span><div><b>Project parameters</b><small>Expansion intent and structural requirements</small></div></div><div className="form-grid"><label>Client<select><option>Pragati Foods Pvt. Ltd. — E2627002</option>{leads.map(l => <option key={l.enq}>{l.company} — {l.enq}</option>)}</select></label><label>Registered turnover<input placeholder="₹ / year" /></label><label>Project intent<select><option>Expansion</option><option>Relocation</option><option>New facility</option></select></label><label>Completion target<input type="date" /></label><label className="wide">Products manufactured<textarea placeholder="Runner products and production capacity growth expectations" /></label></div><div className="check-grid">{["Land purchased", "Land finalized", "Land under discussion", "Existing factory layout available", "Building drawings available"].map(x => <label key={x}><input type="checkbox" /> {x}</label>)}</div><div className="section-title"><span>02</span><div><b>Building & process engineering</b><small>Preferences, utilities and operational constraints</small></div></div><div className="form-grid"><label>Structure<select><option>PEB</option><option>RCC</option><option>Combination</option><option>Not yet decided</option></select></label><label>Floor count<input type="number" defaultValue="1" /></label><label>Crane requirement<select><option>No</option><option>Yes</option></select></label><label>Max. tonnage<input type="number" placeholder="Tonnes" /></label><label>Clear height<input placeholder="Metres" /></label><label>Machine inventory<input type="number" /></label><label className="wide">Manufacturing step-flow<textarea placeholder="Receipt → Stores → Production → QA → Dispatch" /></label></div><div className="check-grid services">{["Gemba Study", "Lean Factory Design", "Machine Layout", "Architectural Design", "Structural / MEP Design", "Construction Management", "Factory Approval", "Complete Turnkey"].map(x => <label key={x}><input type="checkbox" /> {x}</label>)}</div><div className="section-title"><span>03</span><div><b>Stakeholder matrix</b><small>Decision makers and project contacts</small></div></div>{stakeholders.map((s, i) => <div className="stakeholder" key={i}><input aria-label="Stakeholder name" placeholder="Name" value={s.name} onChange={e => setStakeholders(v => v.map((r, x) => x === i ? {...r, name:e.target.value} : r))} /><input aria-label="Designation" placeholder="Designation" value={s.designation} onChange={e => setStakeholders(v => v.map((r, x) => x === i ? {...r, designation:e.target.value} : r))} /><input aria-label="Mobile number" placeholder="Mobile no." value={s.mobile} onChange={e => setStakeholders(v => v.map((r, x) => x === i ? {...r, mobile:e.target.value} : r))} /></div>)}<button className="add-row" onClick={() => setStakeholders(v => [...v, {name:"",designation:"",mobile:""}])}>＋ Add stakeholder</button><div className="drawer-actions"><button onClick={() => setDrawer(null)}>Save draft</button><button className="primary" onClick={() => { setDrawer(null); toast("Visit 01 saved to the account timeline."); }}>Complete visit form</button></div></div>}

      {drawer === "invoice" && <div className="form-body"><div className="mode-switch"><button className={invoiceMode === "Proforma" ? "selected" : ""} onClick={() => setInvoiceMode("Proforma")}>Proforma invoice</button><button className={invoiceMode === "Tax" ? "selected" : ""} onClick={() => setInvoiceMode("Tax")}>Tax invoice</button></div><div className="invoice-grid"><div><div className="section-title"><span>01</span><div><b>Commercial inputs</b><small>GST fixed at 18.00%</small></div></div><label>Target structural area (SqFt)<input type="number" value={area} onChange={e => setArea(Number(e.target.value))} /></label><label>Base rate per SqFt<input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} /></label><div className="bank"><b>Corporate transaction route</b><p>HDFC Bank · Hingne Khurd Branch, Pune</p><p>A/c: 502000024663081 · IFSC: HDFC0000825</p><p>Solutions · PAN: AADPU0566C</p></div></div><div className="invoice-paper"><Mark compact /><span className="doc-type">{invoiceMode.toUpperCase()} INVOICE</span><p>Bill to: {selected.company}</p><div className="calc"><span>Basic project value<b>{money(basic)}</b></span><span>GST @ 18.00%<b>{money(gst)}</b></span><strong>Total commercial amount<b>{money(total)}</b></strong></div><h4>PAYMENT MILESTONES</h4><div className="milestone"><span>01</span><p><b>Advance with PO · 75%</b><small>{money(basic * .75)} + {money(basic * .75 * .18)} GST</small></p><strong>{money(basic * .75 * 1.18)}</strong></div><div className="milestone"><span>02</span><p><b>Before final draft · 25%</b><small>{money(basic * .25)} + {money(basic * .25 * .18)} GST</small></p><strong>{money(basic * .25 * 1.18)}</strong></div></div></div><div className="drawer-actions"><button onClick={() => setDrawer(null)}>Save draft</button><button className="primary" onClick={() => { window.print(); toast(`${invoiceMode} invoice prepared for print / PDF.`); }}>Print / Download PDF</button></div></div>}

      {drawer === "proposal" && <div className="form-body"><div className="proposal-cover"><Mark /><span>PROPOSAL NO. 2627P023</span><h3>Lean Factory Building<sup>©</sup></h3><p>Prepared exclusively for</p><h2>{selected.company}</h2><small>Solutions Optispace · B1/02, Suvidha Dnyanganga Society, Pune</small></div><div className="proposal-phases">{[["01","Discovery","Material flow, step-process mapping, pain-area discovery, dimensional variance and machinery verification."],["02","Design execution","Current State vs. Future State 2D CAD layouts, with a maximum of 3 complementary modifications."],["03","Framework deliverables","VCS© design framework, Visual Factory Data Matrix and Visual Factory Deployment systems."]].map(p => <div key={p[0]}><span>{p[0]}</span><section><b>{p[1]}</b><p>{p[2]}</p></section></div>)}</div><div className="ip-footer"><b>Registered intellectual property</b><p>Lean Factory Building© · LD-23136/2026-CO1</p><p>Visual Countfree Stores© · LD-27055/2026-CO1</p></div><div className="drawer-actions"><button onClick={() => setDrawer(null)}>Save draft</button><button className="primary" onClick={() => { window.print(); toast("Proposal 2627P023 prepared for print / PDF."); }}>Generate proposal</button></div></div>}
    </div></div>}
    {notice && <div className="toast">✓ {notice}</div>}
  </main>;
}
