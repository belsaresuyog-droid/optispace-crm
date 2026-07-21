CREATE TABLE `email_drafts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enq_no` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`trigger_month` integer,
	`state` text DEFAULT 'QUEUED' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_no` text NOT NULL,
	`enq_no` text NOT NULL,
	`mode` text NOT NULL,
	`area_sqft` real NOT NULL,
	`base_rate` real NOT NULL,
	`basic_value` real NOT NULL,
	`gst_value` real NOT NULL,
	`total_value` real NOT NULL,
	`issued_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_no_unique` ON `invoices` (`invoice_no`);--> statement-breakpoint
CREATE TABLE `leads` (
	`enq_no` text PRIMARY KEY NOT NULL,
	`client_name` text NOT NULL,
	`company_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`plot_area` real DEFAULT 0 NOT NULL,
	`built_up_area_sqft` real NOT NULL,
	`source_area_unit` text DEFAULT 'SqFt' NOT NULL,
	`operation_nature` text DEFAULT '' NOT NULL,
	`enquiry_source` text NOT NULL,
	`project_class` text NOT NULL,
	`status` text DEFAULT 'LEAD_RECEIVED' NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` integer NOT NULL,
	`milestone` integer NOT NULL,
	`amount` real NOT NULL,
	`received_at` text NOT NULL,
	`reference` text NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`proposal_no` text NOT NULL,
	`enq_no` text NOT NULL,
	`revision_count` integer DEFAULT 0 NOT NULL,
	`dispatched_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `proposals_proposal_no_unique` ON `proposals` (`proposal_no`);--> statement-breakpoint
CREATE TABLE `touchpoints` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enq_no` text NOT NULL,
	`type` text NOT NULL,
	`sequence_no` integer,
	`scheduled_at` text,
	`occurred_at` text,
	`completed` integer DEFAULT false NOT NULL,
	`travel_voucher_shared` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `visit_forms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`enq_no` text NOT NULL,
	`payload_json` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`) ON UPDATE no action ON DELETE no action
);
