-- AquaPilote : Caisse d'épargne (adhérents, agents, collectes) et Boutique intégrée
-- À exécuter une fois sur le serveur de l'application.

-- ========== CAISSE D'ÉPARGNE ==========
create table if not exists public.savings_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  unit_id uuid not null,
  name text not null,
  phone text,
  commission_rate numeric not null default 0, -- en %
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.savings_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  unit_id uuid not null,
  book_number text not null,          -- numéro de carnet
  full_name text not null,
  phone text,
  agent_id uuid references public.savings_agents(id) on delete set null,
  daily_amount numeric not null default 0, -- mise journalière prévue
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

-- ========== BOUTIQUE ==========
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

-- Propriétaire de l'unité (production_units.user_id) uniquement
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

-- Accès public de la vitrine
create policy "public visible products" on public.shop_products for select to anon using (visible = true);
create policy "public shop settings" on public.shop_settings for select to anon using (enabled = true);
create policy "public place order" on public.shop_orders for insert to anon
  with check (status = 'new' and sale_id is null and total >= 0
              and exists (select 1 from public.shop_settings s where s.unit_id = shop_orders.unit_id and s.enabled));
