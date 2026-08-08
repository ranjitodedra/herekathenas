-- Here Kathenas initial schema
-- persons = real-world nodes; users = claimed accounts

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.persons (
  id uuid primary key default gen_random_uuid(),
  phone_hash text unique,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  person_id uuid not null unique references public.persons (id) on delete restrict,
  username text not null unique,
  display_name text not null,
  avatar_url text,
  bio text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,30}$')
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  person_a_id uuid not null references public.persons (id) on delete cascade,
  person_b_id uuid not null references public.persons (id) on delete cascade,
  source text not null default 'contact_import',
  created_at timestamptz not null default now(),
  constraint connections_no_self check (person_a_id <> person_b_id),
  constraint connections_ordered check (person_a_id < person_b_id)
);

create unique index connections_pair_idx on public.connections (person_a_id, person_b_id);

create table public.external_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null,
  username text,
  url text not null,
  created_at timestamptz not null default now()
);

create table public.contact_imports (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  person_id uuid not null references public.persons (id) on delete cascade,
  contact_name text not null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, person_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index persons_claimed_idx on public.persons (claimed);
create index users_username_idx on public.users (username);
create index users_display_name_idx on public.users (display_name);
create index connections_a_idx on public.connections (person_a_id);
create index connections_b_idx on public.connections (person_b_id);
create index contact_imports_owner_idx on public.contact_imports (owner_user_id);
create index events_name_idx on public.events (event_name, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger persons_updated_at
  before update on public.persons
  for each row execute function public.set_updated_at();

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers (security definer in private-ish functions)
-- ---------------------------------------------------------------------------

create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select person_id from public.users where id = auth.uid();
$$;

create or replace function public.is_claimed_person(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select claimed from public.persons where id = p_id), false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.persons enable row level security;
alter table public.users enable row level security;
alter table public.connections enable row level security;
alter table public.external_profiles enable row level security;
alter table public.contact_imports enable row level security;
alter table public.events enable row level security;

-- persons: claimed persons visible to authenticated; own person always visible
create policy "persons_select_claimed_or_self"
  on public.persons for select to authenticated
  using (
    claimed = true
    or id = public.current_person_id()
    or exists (
      select 1 from public.contact_imports ci
      where ci.person_id = persons.id and ci.owner_user_id = auth.uid()
    )
    or exists (
      select 1 from public.connections c
      where (c.person_a_id = persons.id or c.person_b_id = persons.id)
        and (c.person_a_id = public.current_person_id() or c.person_b_id = public.current_person_id())
    )
  );

create policy "persons_update_own"
  on public.persons for update to authenticated
  using (id = public.current_person_id())
  with check (id = public.current_person_id());

-- users: public profiles for onboarded users; self full access
create policy "users_select_public"
  on public.users for select to authenticated
  using (onboarding_completed = true or id = auth.uid());

create policy "users_insert_self"
  on public.users for insert to authenticated
  with check (id = auth.uid());

create policy "users_update_self"
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users_delete_self"
  on public.users for delete to authenticated
  using (id = auth.uid());

-- connections: visible if user is an endpoint OR connected within ego (neighbor of self)
create policy "connections_select_ego"
  on public.connections for select to authenticated
  using (
    person_a_id = public.current_person_id()
    or person_b_id = public.current_person_id()
    or exists (
      select 1 from public.connections c2
      where (
        (c2.person_a_id = public.current_person_id() and (c2.person_b_id = connections.person_a_id or c2.person_b_id = connections.person_b_id))
        or
        (c2.person_b_id = public.current_person_id() and (c2.person_a_id = connections.person_a_id or c2.person_a_id = connections.person_b_id))
      )
    )
  );

-- inserts/updates via service role / server actions primarily; allow insert when self is endpoint
create policy "connections_insert_self_endpoint"
  on public.connections for insert to authenticated
  with check (
    person_a_id = public.current_person_id()
    or person_b_id = public.current_person_id()
  );

-- external_profiles: public read for claimed users; owner write
create policy "external_profiles_select"
  on public.external_profiles for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = external_profiles.user_id
        and (u.onboarding_completed = true or u.id = auth.uid())
    )
  );

create policy "external_profiles_insert_own"
  on public.external_profiles for insert to authenticated
  with check (user_id = auth.uid());

create policy "external_profiles_update_own"
  on public.external_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "external_profiles_delete_own"
  on public.external_profiles for delete to authenticated
  using (user_id = auth.uid());

-- contact_imports: owner only
create policy "contact_imports_select_own"
  on public.contact_imports for select to authenticated
  using (owner_user_id = auth.uid());

create policy "contact_imports_insert_own"
  on public.contact_imports for insert to authenticated
  with check (owner_user_id = auth.uid());

create policy "contact_imports_delete_own"
  on public.contact_imports for delete to authenticated
  using (owner_user_id = auth.uid());

-- events: insert own; no public read
create policy "events_insert_own"
  on public.events for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- ---------------------------------------------------------------------------
-- Storage: avatars
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
