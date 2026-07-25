CREATE TABLE IF NOT EXISTS `travel_vouchers` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `voucher_no` text NOT NULL UNIQUE,
  `enq_no` text NOT NULL,
  `voucher_date` text NOT NULL,
  `site_location` text DEFAULT '' NOT NULL,
  `contact` text DEFAULT '' NOT NULL,
  `particulars` text DEFAULT 'Travelling Expenses' NOT NULL,
  `travel_from` text DEFAULT 'Solutions Optispace' NOT NULL,
  `travel_to` text DEFAULT '' NOT NULL,
  `amount` real DEFAULT 0 NOT NULL,
  `amount_words` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`enq_no`) REFERENCES `leads`(`enq_no`) ON DELETE CASCADE
);
