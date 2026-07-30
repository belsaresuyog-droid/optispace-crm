CREATE TABLE IF NOT EXISTS `factory_data` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `enq_no` text NOT NULL UNIQUE,
  `payload_json` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`) ON DELETE CASCADE
);
