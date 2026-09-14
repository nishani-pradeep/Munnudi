-- Hand-written: outside Drizzle's table-schema DSL (decision 8's stance also
-- applied here — no dependency on an ORM feature for cross-cutting behaviour).

-- Generic audit trigger. One function attached to every mutable transactional
-- table, so a direct psql edit is captured exactly like an app-level mutation
-- would be, and no future mutation path can simply forget to audit-log itself.
CREATE OR REPLACE FUNCTION audit_log_row_change()
RETURNS TRIGGER AS $$
DECLARE
  v_property_id uuid;
  v_action text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_action := 'DELETE';
    v_property_id := OLD.property_id;
  ELSIF TG_OP = 'INSERT' THEN
    v_action := 'INSERT';
    v_property_id := NEW.property_id;
  ELSE
    v_action := 'UPDATE';
    v_property_id := NEW.property_id;
  END IF;

  INSERT INTO audit_log (property_id, entity_type, entity_id, action, before_json, after_json)
  VALUES (
    v_property_id,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_action,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_unit_month_records
  AFTER INSERT OR UPDATE OR DELETE ON unit_month_records
  FOR EACH ROW EXECUTE FUNCTION audit_log_row_change();

CREATE TRIGGER audit_utility_records
  AFTER INSERT OR UPDATE OR DELETE ON utility_records
  FOR EACH ROW EXECUTE FUNCTION audit_log_row_change();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION audit_log_row_change();

CREATE TRIGGER audit_loan_repayments
  AFTER INSERT OR UPDATE OR DELETE ON loan_repayments
  FOR EACH ROW EXECUTE FUNCTION audit_log_row_change();

-- Append-only: audit_log itself can never be edited or removed, by anyone,
-- including a direct psql session — that is the whole point of an audit trail.
CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING;

-- v_loan_ledger (decision 5): per-loan, per-month recurrence via LAG, anchored
-- at opening_outstanding/opening_as_of_month. `expected` is what the balance
-- SHOULD be from principal_paid and any named adjustment; `effective` prefers
-- a user-entered statement balance when present; `drift` is only non-null
-- when the user actually entered one to compare against (an entered value is
-- what makes the comparison meaningful at all).
CREATE VIEW v_loan_ledger AS
WITH ordered AS (
  SELECT
    lr.id,
    lr.property_id,
    lr.loan_id,
    lr.month,
    lr.principal_paid,
    lr.principal_adjustment,
    lr.outstanding_after_payment,
    l.opening_outstanding,
    l.opening_as_of_month,
    LAG(lr.outstanding_after_payment) OVER (PARTITION BY lr.loan_id ORDER BY lr.month) AS prev_entered,
    LAG(lr.month) OVER (PARTITION BY lr.loan_id ORDER BY lr.month) AS prev_month
  FROM loan_repayments lr
  JOIN loans l ON l.id = lr.loan_id
  WHERE lr.deleted_at IS NULL
),
recurrence AS (
  SELECT
    *,
    COALESCE(prev_entered, opening_outstanding) AS prev_balance
  FROM ordered
)
SELECT
  id,
  property_id,
  loan_id,
  month,
  prev_balance AS opening_balance,
  principal_paid,
  principal_adjustment,
  (prev_balance - principal_paid + principal_adjustment) AS expected_outstanding,
  outstanding_after_payment AS entered_outstanding,
  COALESCE(outstanding_after_payment, prev_balance - principal_paid + principal_adjustment) AS effective_outstanding,
  CASE
    WHEN outstanding_after_payment IS NULL THEN NULL
    ELSE outstanding_after_payment - (prev_balance - principal_paid + principal_adjustment)
  END AS drift
FROM recurrence;
