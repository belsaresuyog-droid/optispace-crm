"use client";

import { FormEvent, useMemo, useState } from "react";
import { importedLeads, importMetadata } from "./imported-leads";

type Lead = {
  enq: string; company: string; contact: string; phone: string; city: string;
  project: string; bua: number; source: string; status: "Lead Received" | "Engagement Initiated" | "Proposal Sent" | "Converted" | "On Hold" | "STOP";
  lastAction: string; nextAction: string; age: string; value: number; proposalNo?: string;
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

const proposalTypes = ["Green Field", "Light Green Field", "Brown Field", "Hybrid", "Turnkey"] as const;
const scopeCatalog = [
  ["Gemba", "2D CAD Industrial Gemba Layout Design", 3],
  ["Architecture", "Complete Architectural Building Design Set", 15],
  ["Structure", "Structural Engineering", 5],
  ["MEP", "MEP Design and On-site Inspection", 15],
  ["Interior", "Office Interior Design and On-site Inspection", 10],
  ["Walkthrough", "3D Walkthrough Animation", 10],
] as const;

function ProposalEditor({ lead, close, toast }: { lead: Lead; close: () => void; toast: (message: string) => void }) {
  const [editing, setEditing] = useState(true);
  const [projectType, setProjectType] = useState<(typeof proposalTypes)[number]>(() => {
    const p = lead.project.toLowerCase(); return p.includes("turnkey") ? "Turnkey" : p.includes("hybrid") ? "Hybrid" : p.includes("brown") ? "Brown Field" : p.includes("light") ? "Light Green Field" : "Green Field";
  });
  const [details, setDetails] = useState({ company: lead.company, address: `${lead.city}, Maharashtra`, attention: lead.contact, proposalNo: lead.proposalNo || "2627P026", proposalDate: "21-07-2026", visitDate: "", plotArea: String(lead.bua || ""), buildingArea: String(lead.bua || ""), buildingType: "PEB", products: "Products and manufacturing processes to be confirmed during discovery.", overview: "The client is planning a new or improved manufacturing facility with efficient material flow, safe operations, future capacity and lean visual management built into the facility design.", painAreas: "Material movement, space utilisation, work-in-process visibility and provision for future expansion.", expectations: "A practical future-state factory layout with coordinated building, utility and implementation guidance." });
  const [scope, setScope] = useState(() => Object.fromEntries(scopeCatalog.map(([id], index) => [id, { enabled: index === 0 || (projectType === "Green Field" && index === 1), rate: scopeCatalog[index][2] }])) as Record<string, { enabled: boolean; rate: number }>);
  const [travel, setTravel] = useState({ km: 0, kmRate: 20, days: 0, people: 2, stayRate: 5000 });
  const area = Number(details.buildingArea) || 0;
  const lines = scopeCatalog.filter(([id]) => scope[id].enabled).map(([id, label]) => ({ id, label, rate: scope[id].rate, amount: area * scope[id].rate }));
  const basic = lines.reduce((sum, line) => sum + line.amount, 0);
  const gst = basic * .18; const travelCost = travel.km * travel.kmRate * 2; const stayCost = travel.days * travel.people * travel.stayRate; const payable = basic + gst + travelCost + stayCost;
  const change = (key: keyof typeof details, value: string) => setDetails(v => ({ ...v, [key]: value }));
  const section = (title: string, children: React.ReactNode) => <section className="editor-section"><h4>{title}</h4>{children}</section>;
  return <div className="proposal-workspace">
    <div className={`proposal-editor ${editing ? "" : "collapsed"}`}>
      <div className="editor-toolbar"><div><span className="eyebrow">EDITABLE PROPOSAL BUILDER</span><b>Proposal content & commercials</b></div><button onClick={() => setEditing(false)}>Hide editor ‹</button></div>
      {section("Proposal type", <div className="type-picker">{proposalTypes.map(type => <button className={projectType === type ? "selected" : ""} onClick={() => setProjectType(type)} key={type}>{type}</button>)}</div>)}
      {section("Client & document", <div className="editor-grid"><label>Company<input value={details.company} onChange={e => change("company", e.target.value)} /></label><label>Kind attention<input value={details.attention} onChange={e => change("attention", e.target.value)} /></label><label className="wide">Address<input value={details.address} onChange={e => change("address", e.target.value)} /></label><label>Proposal number<input value={details.proposalNo} onChange={e => change("proposalNo", e.target.value)} /></label><label>Proposal date<input value={details.proposalDate} onChange={e => change("proposalDate", e.target.value)} /></label><label>Visit date<input value={details.visitDate} placeholder="DD-MM-YYYY" onChange={e => change("visitDate", e.target.value)} /></label></div>)}
      {section("Project brief", <div className="editor-grid"><label>Plot area (SqFt)<input type="number" value={details.plotArea} onChange={e => change("plotArea", e.target.value)} /></label><label>Building area (SqFt)<input type="number" value={details.buildingArea} onChange={e => change("buildingArea", e.target.value)} /></label><label>Building type<select value={details.buildingType} onChange={e => change("buildingType", e.target.value)}><option>PEB</option><option>RCC</option><option>Combination</option><option>To be decided</option></select></label><label className="wide">Products manufactured<textarea value={details.products} onChange={e => change("products", e.target.value)} /></label><label className="wide">About the project<textarea value={details.overview} onChange={e => change("overview", e.target.value)} /></label><label className="wide">Pain areas<textarea value={details.painAreas} onChange={e => change("painAreas", e.target.value)} /></label><label className="wide">Expectations<textarea value={details.expectations} onChange={e => change("expectations", e.target.value)} /></label></div>)}
      {section("Scope & rates", <div className="scope-editor">{scopeCatalog.map(([id, label]) => <div key={id}><label><input type="checkbox" checked={scope[id].enabled} onChange={e => setScope(v => ({ ...v, [id]: { ...v[id], enabled: e.target.checked } }))} /><span>{label}</span></label><label>₹ <input type="number" value={scope[id].rate} onChange={e => setScope(v => ({ ...v, [id]: { ...v[id], rate: Number(e.target.value) } }))} /> / SqFt</label></div>)}</div>)}
      {section("Travel & stay", <div className="editor-grid four"><label>Distance one-way (km)<input type="number" value={travel.km} onChange={e => setTravel(v => ({...v,km:Number(e.target.value)}))} /></label><label>Rate / km<input type="number" value={travel.kmRate} onChange={e => setTravel(v => ({...v,kmRate:Number(e.target.value)}))} /></label><label>Stay days<input type="number" value={travel.days} onChange={e => setTravel(v => ({...v,days:Number(e.target.value)}))} /></label><label>People<input type="number" value={travel.people} onChange={e => setTravel(v => ({...v,people:Number(e.target.value)}))} /></label></div>)}
      <div className="editor-total"><span>Total payable</span><strong>{money(payable)}</strong></div>
    </div>
    <div className="proposal-preview-wrap">
      {!editing && <button className="show-editor" onClick={() => setEditing(true)}>☰ Edit proposal</button>}
      <div className="preview-toolbar"><div><b>Complete proposal preview</b><span>4 pages · All values update instantly</span></div><button onClick={close}>Close</button><button onClick={() => { window.print(); toast(`Proposal ${details.proposalNo} prepared for print / PDF.`); }} className="primary">Print / Download PDF</button></div>
      <article className="proposal-document">
        <section className="proposal-page page-cover"><ProposalHeader number={details.proposalNo} date={details.proposalDate} /><div className="cover-logo" aria-label="Solutions Optispace logo"><img src="/solutions-optispace-logo.jpeg" alt="Solutions Optispace" width="1600" height="604" loading="eager" decoding="sync" /></div><div className="cover-kicker">LEAN FACTORY BUILDING ©</div><h1>Designing flow.<br/>Building performance.</h1><p className="cover-intro">A tailored {projectType} proposal for</p><h2>{details.company}</h2><div className="cover-meta"><span><small>ENQUIRY</small>{lead.enq}</span><span><small>PROJECT CATEGORY</small>{projectType}</span><span><small>LOCATION</small>{lead.city}</span></div><div className="cover-statement">Pioneers of LFB© — a unique blend of Lean Manufacturing and Building Architecture</div></section>
        <section className="proposal-page"><ProposalHeader number={details.proposalNo} date={details.proposalDate} /><PageTitle number="01" title="Project understanding" eyebrow="CLIENT BRIEF" /><div className="address-block"><span>To</span><b>{details.company}</b><p>{details.address}</p><strong>Kind attention: {details.attention}</strong></div><p>Dear Sir,</p><p>Thank you for your enquiry{details.visitDate ? ` and the factory visit held on ${details.visitDate}` : ""}. Your requirement falls under our <b>{projectType}</b> category within the LFB© Lean Factory Building framework.</p><div className="brief-grid"><span><small>Plot area</small>{Number(details.plotArea || 0).toLocaleString("en-IN")} SqFt</span><span><small>Building type</small>{details.buildingType}</span><span><small>Building area</small>{area.toLocaleString("en-IN")} SqFt</span></div><ProposalText title="Products manufactured" text={details.products} /><ProposalText title="About the project" text={details.overview} /><ProposalText title="Pain areas" text={details.painAreas} /><ProposalText title="Expected outcome" text={details.expectations} /><DocumentFooter page="1" /></section>
        <section className="proposal-page"><ProposalHeader number={details.proposalNo} date={details.proposalDate} /><PageTitle number="02" title="Scope & execution" eyebrow="LFB© DELIVERY SYSTEM" /><ProposalBand title="Scope of Optispace" /> <ul className="clean-list">{lines.map(line => <li key={line.id}>{line.label}</li>)}</ul><ProposalBand title="Process steps" /><div className="process-grid">{[["01","Discovery","Product and process study","Current pain areas and expansion vision","Plot/building dimensions","Machinery and equipment verification","Current-state photography"],["02","Design execution","Current-state 2D CAD","Future-state 2D CAD","Process-change guidelines","Architecture coordination where selected","Maximum 3 complementary revisions"],["03","Framework deployment","Visual Countfree Stores (VCS©)","Visual Factory Data Matrix","Visual Factory Deployment guidelines","Lean manufacturing guidance","Delight service after commissioning"]].map(phase => <div key={phase[0]}><span>{phase[0]}</span><section><h3>{phase[1]}</h3><ul>{phase.slice(2).map(item => <li key={item}>{item}</li>)}</ul></section></div>)}</div><div className="two-col"><div><ProposalBand title="Deliverables" /><ul className="clean-list"><li>Proposed factory layout 2D</li><li>Soft copy PDF and editable 2D CAD</li><li>Deployment notes</li><li>VCS© Visual Countfree Stores design</li>{scope.Architecture.enabled && <li>Complete architectural drawing set</li>}{scope.MEP.enabled && <li>MEP design drawings and inspection notes</li>}</ul></div><div><ProposalBand title="Timeline" /><ul className="clean-list"><li>First draft within 15 days from PO</li><li>Final draft within 15 days of draft sign-off</li><li>3 planned project visits</li><li>First 3 amendments included</li><li>Lean guidance until facility commencement</li></ul></div></div><DocumentFooter page="2" /></section>
        <section className="proposal-page"><ProposalHeader number={details.proposalNo} date={details.proposalDate} /><PageTitle number="03" title="Investment & commercials" eyebrow="COMMERCIAL PROPOSAL" /><ProposalBand title="Investment" /><table className="proposal-table"><thead><tr><th>Service</th><th>Area</th><th>Rate / SqFt</th><th>Amount</th></tr></thead><tbody>{lines.map(line => <tr key={line.id}><td>{line.label}</td><td>{area.toLocaleString("en-IN")}</td><td>{money(line.rate)}</td><td>{money(line.amount)}</td></tr>)}<tr className="total"><td colSpan={3}>Basic project value</td><td>{money(basic)}</td></tr><tr><td colSpan={3}>GST @ 18.00%</td><td>{money(gst)}</td></tr>{travelCost > 0 && <tr><td colSpan={3}>Travel - return journey</td><td>{money(travelCost)}</td></tr>}{stayCost > 0 && <tr><td colSpan={3}>Stay - {travel.people} person(s) × {travel.days} day(s)</td><td>{money(stayCost)}</td></tr>}<tr className="grand"><td colSpan={3}>Total payable</td><td>{money(payable)}</td></tr></tbody></table><ProposalBand title="Commercials - how to pay" /><table className="proposal-table"><thead><tr><th>Milestone</th><th>Basic amount</th><th>GST @ 18%</th><th>Payable</th></tr></thead><tbody><tr><td><b>01</b> Advance payment with PO - 75%</td><td>{money(basic*.75)}</td><td>{money(gst*.75)}</td><td>{money((basic+gst)*.75)}</td></tr><tr><td><b>02</b> Before delivery of final draft - 25%</td><td>{money(basic*.25)}</td><td>{money(gst*.25)}</td><td>{money((basic+gst)*.25)}</td></tr><tr className="total"><td>Total</td><td>{money(basic)}</td><td>{money(gst)}</td><td>{money(basic+gst)}</td></tr></tbody></table><div className="terms"><b>Payment terms</b><p>All payments are due within one week of receipt of our proforma invoice. TDS may be deducted on the basic value only. Advance payments are non-refundable in case of delays, hold, or midterm dropout.</p><b>Bank transfer</b><p>HDFC Bank · Account name: Solutions · A/c 502000024663081 · Hingne Khurd Branch, Pune · IFSC HDFC0000825 · PAN AADPU0566C</p></div><div className="signatures"><span><i>Minish Umrani</i><b>CEO, Solutions Optispace</b><small>LeanBlackBelt, USA</small></span><span><i>Ar. Sanket Tambe</i><b>Principal Architect</b><small>Solutions Optispace</small></span></div><DocumentFooter page="3" /></section>
        <section className="proposal-page"><ProposalHeader number={details.proposalNo} date={details.proposalDate} /><PageTitle number="04" title="Our proprietary framework" eyebrow="WHY SOLUTIONS OPTISPACE" /><div className="framework-cards"><ProposalText title="LFB© - Lean Factory Building" text="A proprietary factory design methodology that integrates Lean Manufacturing directly into building design. It aligns architecture, industrial engineering, material flow, utilities, safety and future growth so infrastructure enables operational excellence from day one." /><ProposalText title="VCS© - Visual Countfree Stores" text="An inventory management methodology using visual controls, consumption-based replenishment and standardised practices to improve availability, reduce losses and simplify store management." /><ProposalText title="VFD - Visual Factory Deployment" text="A visual management system using signs, colour coding, floor markings and performance boards so teams can understand status, identify abnormalities and act quickly." /></div><ProposalBand title="Project categories" /><div className="category-list">{[["Green Field","Gemba layout and complete industrial building architecture"],["Light Green Field","Gemba layout for a new bought-out shed or upcoming building"],["Hybrid","Gemba layout for existing and extended facilities"],["Brown Field","Gemba layout for an existing building"],["Turnkey","Gemba layout through completion of the facility"]].map(([a,b]) => <div className={projectType === a ? "selected" : ""} key={a}><b>{a}</b><span>{b}</span></div>)}</div><div className="proof-block"><span>TRUSTED INDUSTRIAL EXPERIENCE</span><h2>Factories designed around flow, people and performance.</h2><div className="sector-grid">{["Automotive","Food processing","Packaging","Sheet metal","Pharmaceuticals","Machinery","Plastics","Industrial equipment","Warehousing","Engineering"].map(x => <span key={x}>{x}</span>)}</div></div><div className="ip-strip"><b>Registered intellectual property</b><span>LFB© · LD-23136/2026-CO1</span><span>VCS© · LD-27055/2026-CO1</span></div><DocumentFooter page="4" /></section>
      </article>
    </div>
  </div>;
}

function ProposalHeader({ number, date }: { number: string; date: string }) { return <header className="doc-header"><Mark compact /><div><span>Solutions Optispace</span><small>B1/02, Suvidha Dnyanganga Society, Pune 411041</small></div><section><small>PROPOSAL</small><b>{number}</b><em>{date}</em></section></header>; }
function PageTitle({ number, title, eyebrow }: { number: string; title: string; eyebrow: string }) { return <div className="page-title"><span>{number}</span><div><small>{eyebrow}</small><h2>{title}</h2></div></div>; }
function ProposalBand({ title }: { title: string }) { return <h3 className="proposal-band">{title}</h3>; }
function ProposalText({ title, text }: { title: string; text: string }) { return <div className="proposal-text"><b>{title}</b><p>{text}</p></div>; }
function DocumentFooter({ page }: { page: string }) { return <footer className="doc-footer"><span>Solutions Optispace · Confidential proposal</span><b>{page} / 4</b></footer>; }

function InvoiceEditor({ lead, mode, setMode, close, openStage, toast }: { lead: Lead; mode: "Proforma" | "Tax"; setMode: (mode: "Proforma" | "Tax") => void; close: () => void; openStage: (stage: "lead" | "visit" | "proposal") => void; toast: (message: string) => void }) {
  const [details, setDetails] = useState({ invoiceNo: "2627OS006", invoiceDate: "21-07-2026", address: `${lead.city}, Maharashtra`, state: "Maharashtra", stateCode: "27", gstin: "", udyam: "", poNo: "Verbal", poDate: "", description: `Advance payment for Solutions Optispace ${lead.project} Project`, activity: "First visit and project commencement", basic: Math.round((lead.value || 0) * .75), distance: 0, kmRate: 20, stayDays: 0, people: 2, stayRate: 5000 });
  const update = (key: keyof typeof details, value: string | number) => setDetails(v => ({ ...v, [key]: value }));
  const interstate = details.state.trim().toLowerCase() !== "maharashtra";
  const basicValue = Number(details.basic) || 0;
  const sgst = interstate ? 0 : basicValue * .09;
  const cgst = interstate ? 0 : basicValue * .09;
  const igst = interstate ? basicValue * .18 : 0;
  const travel = (Number(details.distance) || 0) * (Number(details.kmRate) || 0) * 2;
  const stay = (Number(details.stayDays) || 0) * (Number(details.people) || 0) * (Number(details.stayRate) || 0);
  const unrounded = basicValue + sgst + cgst + igst + travel + stay;
  const payable = Math.round(unrounded);
  const roundOff = payable - unrounded;
  const proposalNo = lead.proposalNo || "2627P026";
  return <div className="invoice-workspace">
    <aside className="invoice-editor">
      <div className="editor-toolbar"><div><span className="eyebrow">EDITABLE INVOICE BUILDER</span><b>Invoice content & statutory details</b></div><button onClick={close}>Close</button></div>
      <div className="invoice-flow"><button onClick={() => openStage("lead")}><small>01 · LEAD</small><b>{lead.enq}</b><span>{lead.company}</span></button><i>›</i><button onClick={() => openStage("visit")}><small>02 · FIRST VISIT</small><b>Visit 01</b><span>Linked discovery</span></button><i>›</i><button onClick={() => openStage("proposal")}><small>03 · PROPOSAL</small><b>{proposalNo}</b><span>{money(lead.value)}</span></button><i>›</i><button className="current"><small>04 · INVOICE</small><b>{details.invoiceNo}</b><span>In preparation</span></button></div>
      <section className="editor-section"><h4>Invoice type & document</h4><div className="mode-switch"><button className={mode === "Proforma" ? "selected" : ""} onClick={() => setMode("Proforma")}>Proforma</button><button className={mode === "Tax" ? "selected" : ""} onClick={() => setMode("Tax")}>Tax invoice</button></div><div className="editor-grid"><label>Invoice number<input value={details.invoiceNo} onChange={e => update("invoiceNo", e.target.value)} /></label><label>Invoice date<input value={details.invoiceDate} onChange={e => update("invoiceDate", e.target.value)} /></label><label>PO number<input value={details.poNo} onChange={e => update("poNo", e.target.value)} /></label><label>PO date<input value={details.poDate} placeholder="DD-MM-YYYY" onChange={e => update("poDate", e.target.value)} /></label></div></section>
      <section className="editor-section"><h4>Invoice to</h4><div className="editor-grid"><label className="wide">Company<input value={lead.company} readOnly /></label><label className="wide">Billing address<textarea value={details.address} onChange={e => update("address", e.target.value)} /></label><label>State<input value={details.state} onChange={e => update("state", e.target.value)} /></label><label>State code<input value={details.stateCode} onChange={e => update("stateCode", e.target.value)} /></label><label>GSTIN<input value={details.gstin} placeholder="Client GSTIN" onChange={e => update("gstin", e.target.value)} /></label><label>Udyam Aadhaar<input value={details.udyam} placeholder="Optional" onChange={e => update("udyam", e.target.value)} /></label></div></section>
      <section className="editor-section"><h4>Service & value</h4><div className="editor-grid"><label className="wide">Description<textarea value={details.description} onChange={e => update("description", e.target.value)} /></label><label className="wide">Activity / milestone<input value={details.activity} onChange={e => update("activity", e.target.value)} /></label><label>Basic value<input type="number" value={details.basic} onChange={e => update("basic", Number(e.target.value))} /></label><label>Tax treatment<input value={interstate ? "IGST 18%" : "SGST 9% + CGST 9%"} readOnly /></label></div></section>
      <section className="editor-section"><h4>Travel & stay</h4><div className="editor-grid four"><label>Distance one-way (km)<input type="number" value={details.distance} onChange={e => update("distance", Number(e.target.value))} /></label><label>Rate / km<input type="number" value={details.kmRate} onChange={e => update("kmRate", Number(e.target.value))} /></label><label>Stay days<input type="number" value={details.stayDays} onChange={e => update("stayDays", Number(e.target.value))} /></label><label>People<input type="number" value={details.people} onChange={e => update("people", Number(e.target.value))} /></label></div></section>
      <div className="editor-total"><span>Total payable</span><strong>{money(payable)}</strong></div>
    </aside>
    <main className="invoice-preview-wrap">
      <div className="preview-toolbar"><div><b>{mode} invoice preview</b><span>Linked to {lead.enq} · {proposalNo}</span></div><button onClick={() => toast(`${mode} invoice ${details.invoiceNo} saved as draft.`)}>Save draft</button><button className="primary" onClick={() => { window.print(); toast(`${mode} invoice ${details.invoiceNo} prepared for PDF.`); }}>Print / Download PDF</button></div>
      <article className="invoice-document">
        <header className="invoice-head"><div className="invoice-logo"><img src="/solutions-optispace-logo.jpeg" alt="Solutions Optispace" width="1600" height="604" loading="eager" decoding="sync" /></div><div><span>{mode.toUpperCase()} INVOICE</span><b>{details.invoiceNo}</b><small>{details.invoiceDate}</small></div></header>
        <section className="invoice-company"><div><b>Solutions (Kaizen Management Systems)</b><span>B1/2, Suvidha Dnyanganga, Jadhavnagar, Vadgaon Bk., Pune 411041</span><span>+91 8975755282 / 9822390363 · minish@leansigmasolutions.in</span><span>www.leansigmasolutions.in</span></div><dl><div><dt>GSTIN</dt><dd>27AADPU0566C1ZT</dd></div><div><dt>State / code</dt><dd>Maharashtra / 27</dd></div><div><dt>HSN / SAC</dt><dd>998311</dd></div><div><dt>Udyam</dt><dd>UDYAM-MH-26-0643279</dd></div></dl></section>
        <section className="invoice-link-strip"><span><small>LEAD</small>{lead.enq}</span><span><small>FIRST VISIT</small>Visit 01</span><span><small>PROPOSAL</small>{proposalNo}</span><span><small>INVOICE</small>{details.invoiceNo}</span></section>
        <section className="invoice-parties"><div><small>INVOICE TO</small><h2>{lead.company}</h2><p>{details.address}</p><span>State: {details.state} · Code: {details.stateCode}</span><span>GSTIN: {details.gstin || "Not provided"} · Udyam: {details.udyam || "Not provided"}</span></div><dl><div><dt>PO number</dt><dd>{details.poNo || "-"}</dd></div><div><dt>PO date</dt><dd>{details.poDate || "-"}</dd></div><div><dt>Enquiry</dt><dd>{lead.enq}</dd></div><div><dt>Proposal</dt><dd>{proposalNo}</dd></div></dl></section>
        <table className="invoice-lines"><thead><tr><th>#</th><th>Description</th><th>Activity / milestone</th><th>Amount</th></tr></thead><tbody><tr><td>01</td><td><b>{details.description}</b><span>{lead.project} · {lead.bua.toLocaleString("en-IN")} SqFt</span></td><td>{details.activity}</td><td>{money(basicValue)}</td></tr></tbody></table>
        <section className="invoice-summary"><div className="invoice-note"><small>AMOUNT IN WORDS</small><b>Indian Rupees {payable.toLocaleString("en-IN")} only</b><div className="invoice-payment"><small>NEFT / RTGS PAYMENT</small><b>HDFC Bank · Account name: Solutions</b><span>A/c 50200002466308 · IFSC HDFC0000825</span><span>Hingne Khurd, Pune 411051 · PAN AADPU0566C</span></div><p>Tax, if deducted, should be deducted on the basic invoice amount as applicable.</p></div><dl><div><dt>Assessable value</dt><dd>{money(basicValue)}</dd></div>{interstate ? <div><dt>IGST @ 18%</dt><dd>{money(igst)}</dd></div> : <><div><dt>SGST @ 9%</dt><dd>{money(sgst)}</dd></div><div><dt>CGST @ 9%</dt><dd>{money(cgst)}</dd></div></>}<div><dt>Travelling charges</dt><dd>{money(travel)}</dd></div><div><dt>Stay charges</dt><dd>{money(stay)}</dd></div><div><dt>Round off</dt><dd>{money(roundOff)}</dd></div><div className="payable"><dt>Total payable</dt><dd>{money(payable)}</dd></div></dl></section>
        {mode === "Proforma" && <div className="proforma-note"><b>Important note</b><span>This proforma invoice is issued for payment purposes only and cannot be used to claim GST credit. A tax invoice will be issued after receipt of payment.</span></div>}
        <footer className="invoice-footer"><span>Solutions Optispace · {mode} invoice · {details.invoiceNo}</span><div><span>For Solutions</span><b>Authorised Signatory</b></div></footer>
      </article>
    </main>
  </div>;
}

function ReportsPanel({ leads, toast }: { leads: Lead[]; toast: (message: string) => void }) {
  const [period, setPeriod] = useState<"Weekly" | "Monthly" | "Quarterly" | "Annual">("Monthly");
  const [year, setYear] = useState("2026-27");
  const reportLeads = year === "2026-27" ? leads : [];
  const proposalLeads = reportLeads.filter(l => l.status === "Proposal Sent" || l.status === "Converted");
  const projectLeads = reportLeads.filter(l => l.status === "Converted");
  const leadToProposal = reportLeads.length ? proposalLeads.length / reportLeads.length * 100 : 0;
  const leadToProject = reportLeads.length ? projectLeads.length / reportLeads.length * 100 : 0;
  const pipelineValue = proposalLeads.reduce((sum, l) => sum + l.value, 0);
  const wonValue = projectLeads.reduce((sum, l) => sum + l.value, 0);
  const today = reportLeads.filter(l => /21[-/]07[-/]2026|21 July 2026/i.test(`${l.lastAction} ${l.age}`));
  const calls = today.filter(l => /call|phone|vcall/i.test(l.lastAction)).length;
  const visits = today.filter(l => /visit|gemba/i.test(l.lastAction)).length;
  const proposalsToday = today.filter(l => l.status === "Proposal Sent" || /proposal/i.test(l.lastAction)).length;
  const newLeads = today.filter(l => l.status === "Lead Received").length;
  const label = period === "Weekly" ? "15-21 Jul 2026" : period === "Monthly" ? "July 2026" : period === "Quarterly" ? "Q2 · Jul-Sep 2026" : `FY ${year}`;
  const statuses = [
    ["Lead received", reportLeads.filter(l => l.status === "Lead Received").length, "#5e7c8c"],
    ["Engaged", reportLeads.filter(l => l.status === "Engagement Initiated").length, "#e6a33d"],
    ["Proposal sent", reportLeads.filter(l => l.status === "Proposal Sent").length, "#d88a35"],
    ["Converted", projectLeads.length, "#78a86a"],
    ["On hold", reportLeads.filter(l => l.status === "On Hold").length, "#b6a36b"],
  ] as const;
  const maxStatus = Math.max(1, ...statuses.map(x => x[1]));
  const digest = `*Solutions Optispace - Daily CRM Report*\n21 July 2026 · 6:00 PM\n\n*Today's work done*\nCalls completed: ${calls}\nFirst visits / Gemba: ${visits}\nProposals sent: ${proposalsToday}\nNew leads received: ${newLeads}\nActivities logged: ${today.length}\n\n*Current dashboard*\nTotal leads: ${reportLeads.length}\nEngagement initiated: ${statuses[1][1]}\nProposal sent: ${statuses[2][1]}\nConverted projects: ${projectLeads.length}\nOn hold: ${statuses[4][1]}\n\nLead to proposal: ${leadToProposal.toFixed(1)}%\nLead to project: ${leadToProject.toFixed(1)}%\nOpen proposal value: ${money(pipelineValue)}\nConverted value: ${money(wonValue)}`;
  const sendWhatsApp = () => { window.open(`https://wa.me/917666258956?text=${encodeURIComponent(digest)}`, "_blank", "noopener,noreferrer"); toast("Daily report prepared in WhatsApp for +91 7666258956."); };
  return <div className="reports-page">
    <header className="reports-head"><div><span className="eyebrow">PERFORMANCE INTELLIGENCE</span><h2>Sales & project reports</h2><p>Track the complete journey from lead receipt to proposal and converted project.</p></div><div className="report-controls"><label>Period<select value={period} onChange={e => setPeriod(e.target.value as typeof period)}><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Annual</option></select></label><label>Financial year<select value={year} onChange={e => setYear(e.target.value)}><option>2026-27</option><option>2025-26</option><option>2024-25</option></select></label></div></header>
    <div className="report-period"><span>{period} report</span><b>{label}</b><small>Financial year {year}</small></div>
    <section className="report-kpis"><article><small>TOTAL LEADS</small><strong>{reportLeads.length}</strong><span>Enquiries in selected year</span></article><article className="accent"><small>LEAD → PROPOSAL</small><strong>{leadToProposal.toFixed(1)}%</strong><span>{proposalLeads.length} of {reportLeads.length} leads</span></article><article className="success"><small>LEAD → PROJECT</small><strong>{leadToProject.toFixed(1)}%</strong><span>{projectLeads.length} converted projects</span></article><article><small>CONVERTED VALUE</small><strong>{money(wonValue)}</strong><span>Proposal value won</span></article></section>
    <section className="reports-grid"><article className="panel report-funnel"><div className="panel-head"><div><span className="eyebrow">CONVERSION FUNNEL</span><h2>Lead journey</h2></div><b>{label}</b></div><div className="funnel-bars">{statuses.map(([name, value, color]) => <div key={name}><span>{name}</span><i><em style={{ width: `${value / maxStatus * 100}%`, background: color }} /></i><b>{value}</b></div>)}</div><div className="ratio-row"><span><small>Proposal conversion</small><b>{leadToProposal.toFixed(1)}%</b></span><span><small>Project conversion</small><b>{leadToProject.toFixed(1)}%</b></span><span><small>Open proposal value</small><b>{money(pipelineValue)}</b></span></div></article>
      <aside className="panel whatsapp-report"><div className="whatsapp-title"><i>◉</i><div><span className="eyebrow">DAILY WHATSAPP REPORT</span><h2>6:00 PM management digest</h2></div></div><div className="schedule-line"><span><small>RECIPIENT</small>+91 7666258956</span><span><small>SCHEDULE</small>Daily · 6:00 PM IST</span></div><div className="connection-warning"><b>Automatic delivery requires connection</b><span>Connect an approved WhatsApp Business/Cloud API account for hands-free scheduled sending.</span></div><pre>{digest}</pre><button className="whatsapp-send" onClick={sendWhatsApp}>Send today’s report on WhatsApp →</button></aside>
    </section>
    <section className="panel daily-breakdown"><div className="panel-head"><div><span className="eyebrow">TODAY · 21 JULY 2026</span><h2>Work completed today</h2></div><span>{today.length} recorded activities</span></div><div>{[["☎","Calls done",calls],["⌂","Visits / Gemba",visits],["▤","Proposals sent",proposalsToday],["＋","New leads",newLeads]].map(x => <article key={x[1]}><i>{x[0]}</i><strong>{x[2]}</strong><span>{x[1]}</span></article>)}</div></section>
  </div>;
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
      <header className="topbar"><div><p>Tuesday, 21 July 2026</p><h1>Good morning, Minish.</h1></div><div className="top-actions"><label className="search"><span>⌕</span><input aria-label="Search leads" placeholder="Search enquiry, company, contact…" value={query} onChange={e => setQuery(e.target.value)} /></label><button className="daily-report-button" onClick={() => setActive("Reports")}>◉ Daily report · 6 PM</button><button className="icon-button" aria-label="Notifications">♢<span /></button><button className="primary" onClick={() => setDrawer("lead")}>＋ Add lead</button></div></header>

      {active === "Reports" ? <ReportsPanel leads={leads} toast={toast} /> : <><div className="import-banner"><span>✓</span><div><b>{importMetadata.total} current leads imported</b><small>{importMetadata.source} · Synced {importMetadata.importedOn}</small></div><div><em>{counts.hold} on hold</em><em className="stop-count">{counts.stop} stopped</em></div></div>

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
      </>}
    </section>

    {drawer && <div className={`overlay ${drawer === "proposal" ? "proposal-overlay" : drawer === "invoice" ? "invoice-overlay" : ""}`} role="dialog" aria-modal="true" aria-label={`${drawer} panel`}><div className={`drawer ${drawer === "proposal" ? "proposal-drawer" : drawer === "invoice" ? "invoice-drawer" : ""}`}>
      {drawer !== "proposal" && drawer !== "invoice" && <header><div><span className="eyebrow">SOLUTIONS OPTISPACE</span><h2>{drawer === "lead" ? "Create new lead" : "Form No. 2 — Visit 01"}</h2><p>{drawer === "visit" ? "Interactive first-visit discovery record" : "Qualify and add an opportunity to the pipeline"}</p></div><button className="close" onClick={() => setDrawer(null)}>×</button></header>}

      {drawer === "lead" && <form onSubmit={addLead} className="form-body"><div className="section-title"><span>01</span><div><b>Client information</b><small>Primary account and contact details</small></div></div><div className="form-grid"><label>Company name *<input name="company" required placeholder="e.g. Apex Manufacturing" /></label><label>Contact person *<input name="contact" required placeholder="Full name" /></label><label>Primary email *<input name="email" type="email" placeholder="name@company.com" /></label><label>Phone number *<input name="phone" required placeholder="+91" /></label><label>City<input name="city" placeholder="Pune" /></label><label>Project class<select name="project"><option>Greenfield</option><option>Light Greenfield</option><option>Hybrid</option><option>Brownfield</option><option>Turnkey</option></select></label><label>Built-up area (SqFt) *<input name="bua" type="number" min="1" placeholder="25000" /></label><label>Enquiry source<select name="source"><option>SMM</option><option>WOM</option><option>Reference</option><option>Kaka Enq</option></select></label></div><div className="drawer-actions"><button type="button" onClick={() => setDrawer(null)}>Cancel</button><button className="primary" type="submit">Create lead</button></div></form>}

      {drawer === "visit" && <div className="form-body visit-form"><div className="section-title"><span>01</span><div><b>Project parameters</b><small>Expansion intent and structural requirements</small></div></div><div className="form-grid"><label>Client<select><option>Pragati Foods Pvt. Ltd. — E2627002</option>{leads.map(l => <option key={l.enq}>{l.company} — {l.enq}</option>)}</select></label><label>Registered turnover<input placeholder="₹ / year" /></label><label>Project intent<select><option>Expansion</option><option>Relocation</option><option>New facility</option></select></label><label>Completion target<input type="date" /></label><label className="wide">Products manufactured<textarea placeholder="Runner products and production capacity growth expectations" /></label></div><div className="check-grid">{["Land purchased", "Land finalized", "Land under discussion", "Existing factory layout available", "Building drawings available"].map(x => <label key={x}><input type="checkbox" /> {x}</label>)}</div><div className="section-title"><span>02</span><div><b>Building & process engineering</b><small>Preferences, utilities and operational constraints</small></div></div><div className="form-grid"><label>Structure<select><option>PEB</option><option>RCC</option><option>Combination</option><option>Not yet decided</option></select></label><label>Floor count<input type="number" defaultValue="1" /></label><label>Crane requirement<select><option>No</option><option>Yes</option></select></label><label>Max. tonnage<input type="number" placeholder="Tonnes" /></label><label>Clear height<input placeholder="Metres" /></label><label>Machine inventory<input type="number" /></label><label className="wide">Manufacturing step-flow<textarea placeholder="Receipt → Stores → Production → QA → Dispatch" /></label></div><div className="check-grid services">{["Gemba Study", "Lean Factory Design", "Machine Layout", "Architectural Design", "Structural / MEP Design", "Construction Management", "Factory Approval", "Complete Turnkey"].map(x => <label key={x}><input type="checkbox" /> {x}</label>)}</div><div className="section-title"><span>03</span><div><b>Stakeholder matrix</b><small>Decision makers and project contacts</small></div></div>{stakeholders.map((s, i) => <div className="stakeholder" key={i}><input aria-label="Stakeholder name" placeholder="Name" value={s.name} onChange={e => setStakeholders(v => v.map((r, x) => x === i ? {...r, name:e.target.value} : r))} /><input aria-label="Designation" placeholder="Designation" value={s.designation} onChange={e => setStakeholders(v => v.map((r, x) => x === i ? {...r, designation:e.target.value} : r))} /><input aria-label="Mobile number" placeholder="Mobile no." value={s.mobile} onChange={e => setStakeholders(v => v.map((r, x) => x === i ? {...r, mobile:e.target.value} : r))} /></div>)}<button className="add-row" onClick={() => setStakeholders(v => [...v, {name:"",designation:"",mobile:""}])}>＋ Add stakeholder</button><div className="drawer-actions"><button onClick={() => setDrawer(null)}>Save draft</button><button className="primary" onClick={() => { setDrawer(null); toast("Visit 01 saved to the account timeline."); }}>Complete visit form</button></div></div>}

      {drawer === "invoice" && <InvoiceEditor lead={selected} mode={invoiceMode} setMode={setInvoiceMode} close={() => setDrawer(null)} openStage={stage => { if (stage === "lead") { setDrawer(null); setActive("Leads"); } else setDrawer(stage); }} toast={toast} />}

      {drawer === "proposal" && <ProposalEditor lead={selected} close={() => setDrawer(null)} toast={toast} />}
    </div></div>}
    {notice && <div className="toast">✓ {notice}</div>}
  </main>;
}
