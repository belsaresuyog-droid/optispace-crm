CREATE TABLE IF NOT EXISTS `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email` text NOT NULL UNIQUE,
  `name` text DEFAULT '' NOT NULL,
  `picture` text DEFAULT '' NOT NULL,
  `role` text DEFAULT 'USER' NOT NULL,
  `is_active` integer DEFAULT 1 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `last_login_at` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `token` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `expires_at` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);
--> statement-breakpoint
INSERT OR IGNORE INTO `users` (`email`, `name`, `role`, `is_active`) VALUES ('belsare.suyog@gmail.com', 'Suyog Belsare', 'ADMIN', 1);

