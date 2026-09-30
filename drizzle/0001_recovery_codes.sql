ALTER TABLE "password_resets" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "password_resets" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_code_hash" text;--> statement-breakpoint
CREATE INDEX "bookings_pending_hold_idx" ON "bookings" USING btree ("hold_expires_at") WHERE "bookings"."status" = 'pending_payment';