create table if not exists public.stock_in_records (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references public.stock(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_buying_price numeric(10,2) not null default 0 check (unit_buying_price >= 0),
  total_cost numeric(12,2) generated always as (quantity * unit_buying_price) stored,
  received_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.stock_in_records to authenticated;
grant all on public.stock_in_records to service_role;
alter table public.stock_in_records enable row level security;
drop policy if exists "Managers manage stock in records" on public.stock_in_records;
create policy "Managers manage stock in records" on public.stock_in_records for all to authenticated using (public.has_role(auth.uid(), 'manager')) with check (public.has_role(auth.uid(), 'manager'));

create index if not exists idx_stock_in_records_received_at on public.stock_in_records(received_at desc);
create index if not exists idx_stock_in_records_variant on public.stock_in_records(variant_id);

create or replace function public.record_stock_in(
  p_stock_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_unit_buying_price numeric,
  p_supplier_id uuid default null,
  p_received_at timestamptz default now(),
  p_notes text default null
) returns public.stock_in_records
language plpgsql security definer set search_path = public
as $$
declare
  result public.stock_in_records;
  variant_product text;
begin
  if not public.has_role(auth.uid(), 'manager') then raise exception 'Manager access required'; end if;
  if p_quantity <= 0 or p_unit_buying_price < 0 then raise exception 'Quantity and buying price are invalid'; end if;
  select p.name into variant_product from public.product_variants v join public.products p on p.id = v.product_id where v.id = p_variant_id;
  insert into public.stock_in_records(stock_id, variant_id, supplier_id, quantity, unit_buying_price, received_at, notes, created_by)
  values(p_stock_id, p_variant_id, p_supplier_id, p_quantity, p_unit_buying_price, p_received_at, p_notes, auth.uid()) returning * into result;
  update public.stock set quantity = quantity + p_quantity, updated_at = now() where id = p_stock_id;
  update public.restock_orders set status = 'fulfilled', fulfilled_at = now(), notes = concat_ws(E'\n', notes, 'Fulfilled by stock-in: ', variant_product)
    where status <> 'fulfilled' and lower(product_name) = lower(variant_product);
  return result;
end;
$$;
revoke all on function public.record_stock_in(uuid, uuid, integer, numeric, uuid, timestamptz, text) from public;
grant execute on function public.record_stock_in(uuid, uuid, integer, numeric, uuid, timestamptz, text) to authenticated;

create or replace function public.update_stock_in_record(p_id uuid, p_quantity integer, p_unit_buying_price numeric, p_supplier_id uuid, p_received_at timestamptz, p_notes text)
returns public.stock_in_records
language plpgsql security definer set search_path = public
as $$
declare old_record public.stock_in_records; result public.stock_in_records;
begin
  if not public.has_role(auth.uid(), 'manager') then raise exception 'Manager access required'; end if;
  select * into old_record from public.stock_in_records where id = p_id for update;
  if old_record.id is null then raise exception 'Stock-in record not found'; end if;
  if p_quantity <= 0 or p_unit_buying_price < 0 then raise exception 'Quantity and buying price are invalid'; end if;
  update public.stock set quantity = greatest(0, quantity - old_record.quantity + p_quantity), updated_at = now() where id = old_record.stock_id;
  update public.stock_in_records set quantity=p_quantity, unit_buying_price=p_unit_buying_price, supplier_id=p_supplier_id, received_at=p_received_at, notes=p_notes, updated_at=now() where id=p_id returning * into result;
  return result;
end;
$$;
revoke all on function public.update_stock_in_record(uuid, integer, numeric, uuid, timestamptz, text) from public;
grant execute on function public.update_stock_in_record(uuid, integer, numeric, uuid, timestamptz, text) to authenticated;

alter table public.stock_in_records replica identity full;
do $$ begin alter publication supabase_realtime add table public.stock_in_records; exception when duplicate_object then null; end $$;

update public.stock set quantity = 40 where quantity is null;
