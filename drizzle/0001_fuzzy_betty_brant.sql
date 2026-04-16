CREATE TYPE "public"."decision_status" AS ENUM('proposed', 'committed');--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"rationale" text NOT NULL,
	"status" "decision_status" DEFAULT 'proposed' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"linear_issue_ids" text[] DEFAULT '{}' NOT NULL,
	"author" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decisions_project_id_idx" ON "decisions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "decisions_status_idx" ON "decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "decisions_created_at_idx" ON "decisions" USING btree ("created_at" DESC NULLS LAST);