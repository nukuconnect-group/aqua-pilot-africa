CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id text NOT NULL,
  employee_name text NOT NULL,
  unit_id text,
  type text NOT NULL DEFAULT 'annuel',
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  employee_id text NOT NULL,
  employee_name text NOT NULL,
  unit_id text,
  amount numeric NOT NULL DEFAULT 0,
  monthly_amount numeric NOT NULL DEFAULT 0,
  months integer NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  loan_id uuid NOT NULL REFERENCES public.employee_loans(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT current_date,
  amount numeric NOT NULL DEFAULT 0,
  period text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_loans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loan_repayments TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
GRANT ALL ON public.employee_loans TO service_role;
GRANT ALL ON public.loan_repayments TO service_role;

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own leave requests" ON public.leave_requests;
CREATE POLICY "own leave requests" ON public.leave_requests
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own employee loans" ON public.employee_loans;
CREATE POLICY "own employee loans" ON public.employee_loans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own loan repayments" ON public.loan_repayments;
CREATE POLICY "own loan repayments" ON public.loan_repayments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_user ON public.leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_user ON public.employee_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_employee ON public.employee_loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON public.loan_repayments(loan_id);

CREATE TRIGGER trg_leave_requests_updated_at BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_employee_loans_updated_at BEFORE UPDATE ON public.employee_loans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "own support messages update" ON public.support_messages;
CREATE POLICY "own support messages update" ON public.support_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "own support messages delete" ON public.support_messages;
CREATE POLICY "own support messages delete" ON public.support_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

GRANT UPDATE, DELETE ON public.support_messages TO authenticated;

ALTER TABLE public.support_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;