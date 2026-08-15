CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`step_threshold` integer DEFAULT 15 NOT NULL,
	`rearm_seconds` integer DEFAULT 20 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "app_settings_singleton" CHECK("app_settings"."id" = 1)
);
