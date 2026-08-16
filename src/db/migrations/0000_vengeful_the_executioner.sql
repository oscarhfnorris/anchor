CREATE TABLE `alarm_days` (
	`alarm_id` integer NOT NULL,
	`weekday` integer NOT NULL,
	PRIMARY KEY(`alarm_id`, `weekday`),
	FOREIGN KEY (`alarm_id`) REFERENCES `alarms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "alarm_days_weekday" CHECK("alarm_days"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE `alarms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`hour` integer NOT NULL,
	`minute` integer NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "alarms_hour" CHECK("alarms"."hour" between 0 and 23),
	CONSTRAINT "alarms_minute" CHECK("alarms"."minute" between 0 and 59)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alarms_kind_unique` ON `alarms` (`kind`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`step_threshold` integer DEFAULT 15 NOT NULL,
	`rearm_seconds` integer DEFAULT 20 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "app_settings_singleton" CHECK("app_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `occurrences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alarm_id` integer NOT NULL,
	`due_at` integer NOT NULL,
	`fired_at` integer,
	`cleared_at` integer,
	`outcome` text,
	`place_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`alarm_id`) REFERENCES `alarms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `occurrences_alarm_idx` ON `occurrences` (`alarm_id`);--> statement-breakpoint
CREATE INDEX `occurrences_unfired_idx` ON `occurrences` (`due_at`) WHERE fired_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX `occurrences_alarm_due` ON `occurrences` (`alarm_id`,`due_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` text NOT NULL,
	`role` text NOT NULL,
	`place_id` integer,
	`label` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_uid_unique` ON `tags` (`uid`);--> statement-breakpoint
CREATE INDEX `tags_role_idx` ON `tags` (`role`);