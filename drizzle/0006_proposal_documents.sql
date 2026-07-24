CREATE TABLE IF NOT EXISTS `proposal_documents` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `proposal_no` text NOT NULL UNIQUE,
  `enq_no` text NOT NULL,
  `payload_json` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`)
);

