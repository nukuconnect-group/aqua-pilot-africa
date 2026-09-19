-- Congés, prêts et remboursements (module RH & Paie d'AquaPilote).
-- À exécuter dans le projet Supabase utilisé par l'application.
-- Tant que ces tables n'existent pas, l'application stocke les données localement.

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  employee_id text not null,
  employee_name text not null,
  unit_id text,
  type text not null default 'annuel',
  start_date date not null,
  end_date date not null,
  days integer not null default 0,
  reason text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  employee_id text not null,
  employee_name text not null,
  unit_id text,
  amount numeric not null default 0,
  monthly_amount numeric not null default 0,
  months integer not null default 0,
  start_date date not null,
  reason text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  loan_id uuid not null references public.employee_loans(id) on delete cascade,
  date date not null default current_date,
  amount numeric not null default 0,
  period text,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.leave_requests to authenticated;
grant select, insert, update, delete on public.employee_loans to authenticated;
grant select, insert, update, delete on public.loan_repayments to authenticated;
grant all on public.leave_requests to service_role;
grant all on public.employee_loans to service_role;
grant all on public.loan_repayments to service_role;

alter table public.leave_requests enable row level security;
alter table public.employee_loans enable row level security;
alter table public.loan_repayments enable row level security;

drop policy if exists "own leave requests" on public.leave_requests;
create policy "own leave requests" on public.leave_requests
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own employee loans" on public.employee_loans;
create policy "own employee loans" on public.employee_loans
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own loan repayments" on public.loan_repayments;
create policy "own loan repayments" on public.loan_repayments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index utiles
create index if not exists idx_leave_requests_user on public.leave_requests(user_id);
create index if not exists idx_leave_requests_employee on public.leave_requests(employee_id);
create index if not exists idx_employee_loans_user on public.employee_loans(user_id);
create index if not exists idx_employee_loans_employee on public.employee_loans(employee_id);
create index if not exists idx_loan_repayments_loan on public.loan_repayments(loan_id);

-- Mise à jour automatique de updated_at
create or replace function public.hr_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_leave_requests_updated_at on public.leave_requests;
create trigger trg_leave_requests_updated_at before update on public.leave_requests
  for each row execute function public.hr_touch_updated_at();

drop trigger if exists trg_employee_loans_updated_at on public.employee_loans;
create trigger trg_employee_loans_updated_at before update on public.employee_loans
  for each row execute function public.hr_touch_updated_at();
