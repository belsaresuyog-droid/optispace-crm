CREATE TABLE IF NOT EXISTS `invoice_documents` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `invoice_no` text NOT NULL UNIQUE,
  `enq_no` text NOT NULL,
  `mode` text DEFAULT 'Proforma' NOT NULL,
  `payload_json` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`)
);

