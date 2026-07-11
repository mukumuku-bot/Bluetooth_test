create table if not exists public.battery_alert_state (
  id boolean primary key default true,
  active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint battery_alert_state_singleton check (id = true)
);

alter table public.battery_alert_state enable row level security;

insert into public.battery_alert_state (id, active)
values (true, false)
on conflict (id) do nothing;
