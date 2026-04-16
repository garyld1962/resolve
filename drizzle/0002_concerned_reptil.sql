ALTER TABLE "decisions" ADD COLUMN "chain_position" bigint;--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "content_hash" "bytea";--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "prev_hash" "bytea";--> statement-breakpoint
ALTER TABLE "decisions" ADD COLUMN "entry_hash" "bytea";--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_chain_position_per_project_idx" ON "decisions" USING btree ("project_id","chain_position");