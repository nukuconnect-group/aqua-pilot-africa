CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id text NOT NULL,
  opened_by uuid NOT NULL DEFAULT auth.uid(),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_amount numeric NOT NULL DEFAULT 0,
  closed_at timestamptz,
  expected_amount numeric,
  counted_amount numeric,
  difference numeric,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cash_sessions_one_open_per_unit ON public.cash_sessions (user_id, unit_id) WHERE status = 'open';
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  unit_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('sale','cash_in','cash_out')),
  amount numeric NOT NULL CHECK (amount >= 0),
  payment_method text NOT NULL DEFAULT 'Espèces',
  sale_id uuid,
  label text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.cash_sessions TO authenticated;
GRANT SELECT, INSERT ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_sessions, public.cash_movements TO service_role;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cash_sessions owner or team" ON public.cash_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id))
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
CREATE POLICY "cash_movements owner or team read" ON public.cash_movements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
CREATE POLICY "cash_movements owner or team insert" ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_sessions, public.cash_movements;

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id text,
  employee_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('in','out')),
  recorded_at timestamptz NOT NULL,
  latitude double precision,
  longitude double precision,
  distance_m numeric,
  inside_zone boolean,
  photo_path text,
  client_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_records TO service_role;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance owner or team read" ON public.attendance_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member_of(user_id));
CREATE POLICY "attendance owner or team insert" ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_team_member_of(user_id));

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id text NOT NULL,
  stock_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('in','out','adjust')),
  quantity numeric NOT NULL,
  quantity_after numeric NOT NULL,
  reason text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements read" ON public.stock_movements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));
CREATE POLICY "stock_movements insert" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.team_member_has_unit_access(user_id, unit_id));

create table if not exists public.savings_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  unit_id uuid not null,
  name text not null,
  phone text,
  commission_rate numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.savings_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  unit_id uuid not null,
  book_number text not null,
  full_name text not null,
  phone text,
  agent_id uuid references public.savings_agents(id) on delete set null,
  daily_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (unit_id, book_number)
);
create table if not exists public.savings_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  unit_id uuid not null,
  member_id uuid not null references public.savings_members(id) on delete cascade,
  agent_id uuid references public.savings_agents(id) on delete set null,
  type text not null check (type in ('deposit','withdrawal')),
  amount numeric not null check (amount > 0),
  date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);
create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  unit_id uuid not null,
  name text not null,
  description text,
  price numeric not null default 0,
  unit_label text not null default 'kg',
  stock numeric not null default 0,
  image_url text,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  customer_name text not null,
  customer_phone text not null,
  customer_address text,
  items jsonb not null default '[]',
  total numeric not null default 0,
  status text not null default 'new' check (status in ('new','confirmed','delivered','cancelled')),
  note text,
  sale_id uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.shop_settings (
  unit_id uuid primary key,
  user_id uuid not null,
  shop_name text not null,
  banner text,
  whatsapp text,
  enabled boolean not null default true
);
grant select, insert, update, delete on public.savings_agents, public.savings_members, public.savings_transactions,
  public.shop_products, public.shop_orders, public.shop_settings to authenticated;
grant all on public.savings_agents, public.savings_members, public.savings_transactions,
  public.shop_products, public.shop_orders, public.shop_settings to service_role;
grant select on public.shop_products, public.shop_settings to anon;
grant insert on public.shop_orders to anon;
alter table public.savings_agents enable row level security;
alter table public.savings_members enable row level security;
alter table public.savings_transactions enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_settings enable row level security;
create or replace function public.owns_unit(_unit uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.production_units where id = _unit and user_id = auth.uid())
$$;
create policy "owner savings_agents" on public.savings_agents for all to authenticated using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy "owner savings_members" on public.savings_members for all to authenticated using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy "owner savings_tx" on public.savings_transactions for all to authenticated using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy "owner shop_products" on public.shop_products for all to authenticated using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy "owner shop_orders" on public.shop_orders for all to authenticated using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy "owner shop_settings" on public.shop_settings for all to authenticated using (public.owns_unit(unit_id)) with check (public.owns_unit(unit_id));
create policy "public visible products" on public.shop_products for select to anon using (visible = true);
create policy "public shop settings" on public.shop_settings for select to anon using (enabled = true);
create policy "public place order" on public.shop_orders for insert to anon
  with check (status = 'new' and sale_id is null and total >= 0
              and exists (select 1 from public.shop_settings s where s.unit_id = shop_orders.unit_id and s.enabled));