ALTER TABLE `leads` ADD `website` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `leads` ADD `last_action` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `leads` ADD `next_action` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `leads` ADD `age_label` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `leads` ADD `proposal_value` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `leads` ADD `proposal_no` text;
--> statement-breakpoint
ALTER TABLE `leads` ADD `deleted_at` text;
