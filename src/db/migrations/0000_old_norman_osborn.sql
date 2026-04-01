CREATE TABLE `agent_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`source` text NOT NULL,
	`input` text,
	`output` text,
	`created_at` integer
);
--> statement-breakpoint
CREATE INDEX `agent_logs_user_id_idx` ON `agent_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `approval_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`queue_id` integer NOT NULL,
	`draft_response` text NOT NULL,
	`source` text NOT NULL,
	`recipient_info` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer,
	`decided_at` integer,
	FOREIGN KEY (`queue_id`) REFERENCES `message_queue`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `approval_responses_user_id_idx` ON `approval_responses` (`user_id`);--> statement-breakpoint
CREATE INDEX `approval_responses_queue_id_idx` ON `approval_responses` (`queue_id`);--> statement-breakpoint
CREATE TABLE `graph_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`resource` text NOT NULL,
	`subscription_id` text NOT NULL,
	`expiration_date_time` integer NOT NULL,
	`change_type` text NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `graph_subscriptions_user_id_idx` ON `graph_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `message_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`resource_id` text NOT NULL,
	`chat_id` text,
	`subject` text,
	`from_address` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`ai_response` text,
	`created_at` integer,
	`processed_at` integer
);
--> statement-breakpoint
CREATE INDEX `message_queue_user_id_idx` ON `message_queue` (`user_id`);--> statement-breakpoint
CREATE INDEX `message_queue_status_idx` ON `message_queue` (`status`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`source` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`expires_at` integer NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`openrouter_api_key` text,
	`openrouter_model` text DEFAULT 'anthropic/claude-sonnet-4',
	`agent_auto_reply` integer DEFAULT false,
	`agent_auto_summary` integer DEFAULT false,
	`agent_tone` text DEFAULT 'professional',
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_user_id_unique` ON `settings` (`user_id`);