CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"tracking_start_month" varchar(7) NOT NULL,
	"include_self_occupied_in_target" boolean DEFAULT false NOT NULL,
	"count_vacant_in_target" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_tracking_start_month_format" CHECK ("properties"."tracking_start_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_code" text NOT NULL,
	"unit_type" text NOT NULL,
	"default_occupancy_status" text NOT NULL,
	"electricity_uom" text DEFAULT 'kWh' NOT NULL,
	"water_uom" text DEFAULT 'L' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_unit_type_check" CHECK ("units"."unit_type" IN ('2BHK','1BHK')),
	CONSTRAINT "units_default_occupancy_status_check" CHECK ("units"."default_occupancy_status" IN ('SELF_OCCUPIED','OCCUPIED','VACANT'))
);
--> statement-breakpoint
CREATE TABLE "unit_rent_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"effective_month" varchar(7) NOT NULL,
	"expected_rent" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_rent_versions_effective_month_format" CHECK ("unit_rent_versions"."effective_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "unit_rent_versions_expected_rent_nonneg" CHECK ("unit_rent_versions"."expected_rent" >= 0)
);
--> statement-breakpoint
CREATE TABLE "unit_month_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"occupancy_snapshot" text NOT NULL,
	"expected_rent_snapshot" numeric(14, 2) DEFAULT '0' NOT NULL,
	"is_billable" boolean GENERATED ALWAYS AS ((occupancy_snapshot <> 'SELF_OCCUPIED')) STORED NOT NULL,
	"paid_amount" numeric(14, 2),
	"payment_date" date,
	"comment" text,
	"status" text GENERATED ALWAYS AS ((
        CASE
          WHEN occupancy_snapshot = 'SELF_OCCUPIED' THEN 'NOT_BILLABLE'
          WHEN paid_amount IS NULL THEN 'UNSET'
          WHEN paid_amount = 0 THEN 'UNPAID'
          WHEN paid_amount < expected_rent_snapshot THEN 'PARTIAL'
          WHEN paid_amount = expected_rent_snapshot THEN 'PAID'
          ELSE 'OVERPAID'
        END
      )) STORED NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unit_month_records_month_format" CHECK ("unit_month_records"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "unit_month_records_occupancy_check" CHECK ("unit_month_records"."occupancy_snapshot" IN ('SELF_OCCUPIED','OCCUPIED','VACANT')),
	CONSTRAINT "unit_month_records_paid_amount_nonneg" CHECK ("unit_month_records"."paid_amount" IS NULL OR "unit_month_records"."paid_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "utility_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"utility_type" text NOT NULL,
	"uom_snapshot" text NOT NULL,
	"previous_reading" numeric(14, 3),
	"current_reading" numeric(14, 3),
	"usage_override" numeric(14, 3),
	"meter_event" text DEFAULT 'NONE' NOT NULL,
	"rollover_max" numeric(14, 3),
	"bill_amount" numeric(14, 2),
	"bill_paid" boolean,
	"no_bill_this_month" boolean DEFAULT false NOT NULL,
	"comment" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utility_records_month_format" CHECK ("utility_records"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "utility_records_type_check" CHECK ("utility_records"."utility_type" IN ('ELECTRICITY','WATER')),
	CONSTRAINT "utility_records_meter_event_check" CHECK ("utility_records"."meter_event" IN ('NONE','RESET','ROLLOVER','REPLACED')),
	CONSTRAINT "utility_records_no_negative_usage" CHECK ("utility_records"."meter_event" <> 'NONE' OR "utility_records"."previous_reading" IS NULL OR "utility_records"."current_reading" IS NULL OR "utility_records"."current_reading" >= "utility_records"."previous_reading")
);
--> statement-breakpoint
CREATE TABLE "expense_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_maintenance" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"unit_id" uuid,
	"month" varchar(7) NOT NULL,
	"expense_date" date,
	"category_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"comment" text,
	"reference" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_month_format" CHECK ("expenses"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"loan_type" text NOT NULL,
	"lender" text,
	"original_principal" numeric(14, 2),
	"opening_outstanding" numeric(14, 2) NOT NULL,
	"opening_as_of_month" varchar(7) NOT NULL,
	"interest_rate" numeric(6, 3),
	"scheduled_emi" numeric(14, 2),
	"expects_monthly_payment" boolean DEFAULT true NOT NULL,
	"closed_month" varchar(7),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loans_opening_as_of_month_format" CHECK ("loans"."opening_as_of_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "loans_closed_month_format" CHECK ("loans"."closed_month" IS NULL OR "loans"."closed_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "loan_repayments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"payment_date" date NOT NULL,
	"total_payment" numeric(14, 2) NOT NULL,
	"principal_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"interest_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"other_charges" numeric(14, 2) DEFAULT '0' NOT NULL,
	"principal_adjustment" numeric(14, 2) DEFAULT '0' NOT NULL,
	"adjustment_reason" text,
	"outstanding_after_payment" numeric(14, 2),
	"comment" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loan_repayments_month_format" CHECK ("loan_repayments"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "loan_repayments_total_positive" CHECK ("loan_repayments"."total_payment" > 0),
	CONSTRAINT "loan_repayments_principal_nonneg" CHECK ("loan_repayments"."principal_paid" >= 0),
	CONSTRAINT "loan_repayments_interest_nonneg" CHECK ("loan_repayments"."interest_paid" >= 0),
	CONSTRAINT "loan_repayments_other_nonneg" CHECK ("loan_repayments"."other_charges" >= 0),
	CONSTRAINT "loan_repayments_parts_within_total" CHECK ("loan_repayments"."principal_paid" + "loan_repayments"."interest_paid" + "loan_repayments"."other_charges" <= "loan_repayments"."total_payment"),
	CONSTRAINT "loan_repayments_adjustment_needs_reason" CHECK ("loan_repayments"."principal_adjustment" = 0 OR "loan_repayments"."adjustment_reason" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "monthly_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"month" varchar(7) NOT NULL,
	"state" text DEFAULT 'OPEN' NOT NULL,
	"rent_reviewed_at" timestamp with time zone,
	"utilities_reviewed_at" timestamp with time zone,
	"expenses_reviewed_at" timestamp with time zone,
	"loans_reviewed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"reopened_at" timestamp with time zone,
	CONSTRAINT "monthly_status_month_format" CHECK ("monthly_status"."month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "monthly_status_state_check" CHECK ("monthly_status"."state" IN ('OPEN','CLOSED'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_rent_versions" ADD CONSTRAINT "unit_rent_versions_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_month_records" ADD CONSTRAINT "unit_month_records_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_month_records" ADD CONSTRAINT "unit_month_records_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_records" ADD CONSTRAINT "utility_records_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utility_records" ADD CONSTRAINT "utility_records_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_status" ADD CONSTRAINT "monthly_status_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "units_property_unit_code_key" ON "units" USING btree ("property_id","unit_code");--> statement-breakpoint
CREATE INDEX "units_property_id_idx" ON "units" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_rent_versions_unit_month_key" ON "unit_rent_versions" USING btree ("unit_id","effective_month");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_month_records_unit_month_key" ON "unit_month_records" USING btree ("unit_id","month") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "unit_month_records_property_id_idx" ON "unit_month_records" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "unit_month_records_month_idx" ON "unit_month_records" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "utility_records_unit_month_type_key" ON "utility_records" USING btree ("unit_id","month","utility_type") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "utility_records_property_id_idx" ON "utility_records" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "utility_records_month_idx" ON "utility_records" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_property_name_key" ON "expense_categories" USING btree ("property_id","name");--> statement-breakpoint
CREATE INDEX "expenses_property_id_idx" ON "expenses" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "expenses_month_idx" ON "expenses" USING btree ("month");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_repayments_loan_month_key" ON "loan_repayments" USING btree ("loan_id","month") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "loan_repayments_property_id_idx" ON "loan_repayments" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "loan_repayments_loan_id_idx" ON "loan_repayments" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_status_property_month_key" ON "monthly_status" USING btree ("property_id","month");--> statement-breakpoint
CREATE INDEX "audit_log_property_entity_idx" ON "audit_log" USING btree ("property_id","entity_type","entity_id","created_at");