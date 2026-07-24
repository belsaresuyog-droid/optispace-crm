import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leads = sqliteTable("leads", {
  enqNo: text("enq_no").primaryKey(),
  clientName: text("client_name").notNull(), companyName: text("company_name").notNull(),
  email: text("email").notNull(), phone: text("phone").notNull(), city: text("city").notNull().default(""), address: text("address").notNull().default(""),
  website: text("website").notNull().default(""),
  plotArea: real("plot_area").notNull().default(0), builtUpAreaSqft: real("built_up_area_sqft").notNull(), sourceAreaUnit: text("source_area_unit").notNull().default("SqFt"),
  operationNature: text("operation_nature").notNull().default(""), enquirySource: text("enquiry_source").notNull(), projectClass: text("project_class").notNull(),
  status: text("status", { enum: ["LEAD_RECEIVED", "ENGAGED", "PROPOSAL_SENT", "CONVERTED", "ON_HOLD", "REJECTED", "STOP"] }).notNull().default("LEAD_RECEIVED"),
  highPotential: integer("high_potential", { mode:"boolean" }).notNull().default(false),
  lastAction: text("last_action").notNull().default(""), nextAction: text("next_action").notNull().default(""), ageLabel: text("age_label").notNull().default(""),
  proposalValue: real("proposal_value").notNull().default(0), proposalNo: text("proposal_no"),
  receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
});

export const touchpoints = sqliteTable("touchpoints", {
  id: integer("id").primaryKey({ autoIncrement: true }), enqNo: text("enq_no").notNull().references(() => leads.enqNo),
  type: text("type", { enum: ["PHONE", "VIDEO", "SITE_VISIT", "EMAIL", "NOTE"] }).notNull(), sequenceNo: integer("sequence_no"),
  scheduledAt: text("scheduled_at"), occurredAt: text("occurred_at"), completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  travelVoucherShared: integer("travel_voucher_shared", { mode: "boolean" }).notNull().default(false), notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const proposals = sqliteTable("proposals", {
  id: integer("id").primaryKey({ autoIncrement: true }), proposalNo: text("proposal_no").notNull().unique(), enqNo: text("enq_no").notNull().references(() => leads.enqNo),
  revisionCount: integer("revision_count").notNull().default(0), dispatchedAt: text("dispatched_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }), invoiceNo: text("invoice_no").notNull().unique(), enqNo: text("enq_no").notNull().references(() => leads.enqNo),
  mode: text("mode", { enum: ["PROFORMA", "TAX"] }).notNull(), areaSqft: real("area_sqft").notNull(), baseRate: real("base_rate").notNull(),
  basicValue: real("basic_value").notNull(), gstValue: real("gst_value").notNull(), totalValue: real("total_value").notNull(), issuedAt: text("issued_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }), invoiceId: integer("invoice_id").notNull().references(() => invoices.id),
  milestone: integer("milestone").notNull(), amount: real("amount").notNull(), receivedAt: text("received_at").notNull(), reference: text("reference").notNull(),
});

export const visitForms = sqliteTable("visit_forms", {
  id: integer("id").primaryKey({ autoIncrement: true }), enqNo: text("enq_no").notNull().references(() => leads.enqNo),
  payloadJson: text("payload_json").notNull(), completedAt: text("completed_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const emailDrafts = sqliteTable("email_drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }), enqNo: text("enq_no").notNull().references(() => leads.enqNo), subject: text("subject").notNull(), body: text("body").notNull(),
  triggerMonth: integer("trigger_month"), state: text("state", { enum: ["QUEUED", "SENT", "DISMISSED"] }).notNull().default("QUEUED"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const intelligenceProfiles = sqliteTable("intelligence_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }), enqNo: text("enq_no").notNull().references(() => leads.enqNo),
  companyJson: text("company_json").notNull(), digitalFootprintJson: text("digital_footprint_json").notNull(), behavioralTraitsJson: text("behavioral_traits_json").notNull(),
  confidence: text("confidence").notNull().default("PRELIMINARY"), reviewed: integer("reviewed", { mode:"boolean" }).notNull().default(false), generatedAt: text("generated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const proposalIntelligence = sqliteTable("proposal_intelligence", {
  id: integer("id").primaryKey({ autoIncrement: true }), enqNo: text("enq_no").notNull().references(() => leads.enqNo),
  markdown: text("markdown").notNull(), projectFramework: text("project_framework").notNull(), estimatedBasicValue: real("estimated_basic_value").notNull().default(0), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const socialSnapshots = sqliteTable("social_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }), channel: text("channel").notNull(), capturedAt: text("captured_at").notNull(),
  reach: integer("reach").notNull().default(0), followers: integer("followers").notNull().default(0), engagementRate: real("engagement_rate").notNull().default(0), payloadJson: text("payload_json").notNull().default("{}"),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  picture: text("picture").notNull().default(""),
  role: text("role", { enum: ["ADMIN", "USER"] }).notNull().default("USER"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastLoginAt: text("last_login_at"),
});

export const authSessions = sqliteTable("auth_sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
