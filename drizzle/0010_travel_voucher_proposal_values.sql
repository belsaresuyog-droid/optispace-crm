ALTER TABLE `travel_vouchers` ADD `distance_km` real DEFAULT 0 NOT NULL;
ALTER TABLE `travel_vouchers` ADD `km_rate` real DEFAULT 20 NOT NULL;
ALTER TABLE `travel_vouchers` ADD `stay_days` real DEFAULT 0 NOT NULL;
ALTER TABLE `travel_vouchers` ADD `people` real DEFAULT 2 NOT NULL;
ALTER TABLE `travel_vouchers` ADD `stay_rate` real DEFAULT 5000 NOT NULL;
