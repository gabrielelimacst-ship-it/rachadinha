-- =====================================================================
-- Rachadinha · estrutura do banco no Supabase
-- Cole tudo isto em: Supabase > SQL Editor > New query > Run
-- Pode rodar mais de uma vez sem problema.
-- =====================================================================

-- Uma "casa" = as duas pessoas que dividem as contas
create table if not exists public.households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Nossa casa',
  code       text unique not null,                 -- código de convite
  created_at timestamptz not null default now()
);

-- Quem mora em cada casa (no máximo 2: p1 = quem criou, p2 = quem entrou com o código)
create table if not exists public.members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  slot         text not null check (slot in ('p1', 'p2')),
  name         text not null default '',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (household_id, slot),
  unique (user_id)                                  -- cada login participa de uma casa só
);

-- Lançamentos: despesas, pagamentos, acertos e configuração (renda/percentual)
create table if not exists public.records (
  household_id uuid not null references public.households(id) on delete cascade,
  kind         text not null check (kind in ('config', 'expenses', 'payments', 'settles')),
  id           text not null,
  data         jsonb not null,
  updated_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid(),
  primary key (household_id, kind, id)
);
alter table public.records replica identity full;

-- ---------- quem é membro de qual casa ----------
create or replace function public.is_member(h uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where household_id = h and user_id = auth.uid());
$$;

-- ---------- segurança: cada pessoa só vê a própria casa ----------
alter table public.households enable row level security;
alter table public.members    enable row level security;
alter table public.records    enable row level security;

drop policy if exists "ver minha casa" on public.households;
create policy "ver minha casa" on public.households for select using (public.is_member(id));

drop policy if exists "ver membros da minha casa" on public.members;
create policy "ver membros da minha casa" on public.members for select using (public.is_member(household_id));

drop policy if exists "editar meu nome" on public.members;
create policy "editar meu nome" on public.members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "lancamentos da minha casa" on public.records;
create policy "lancamentos da minha casa" on public.records for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ---------- criar casa / entrar com código ----------
create or replace function public.create_household(p_name text, p_display text)
returns json language plpgsql security definer set search_path = public as $$
declare h public.households; c text;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Você já participa de uma casa.';
  end if;
  loop
    c := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.households where code = c);
  end loop;
  insert into public.households (name, code) values (coalesce(nullif(trim(p_name), ''), 'Nossa casa'), c) returning * into h;
  insert into public.members (household_id, user_id, slot, name) values (h.id, auth.uid(), 'p1', coalesce(p_display, ''));
  return json_build_object('id', h.id, 'code', h.code);
end $$;

create or replace function public.join_household(p_code text, p_display text)
returns json language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Faça login primeiro.'; end if;
  if exists (select 1 from public.members where user_id = auth.uid()) then
    raise exception 'Você já participa de uma casa.';
  end if;
  select * into h from public.households where code = upper(trim(p_code));
  if h.id is null then raise exception 'Código não encontrado. Confira as letras e números.'; end if;
  if (select count(*) from public.members where household_id = h.id) >= 2 then
    raise exception 'Esta casa já tem duas pessoas.';
  end if;
  insert into public.members (household_id, user_id, slot, name) values (h.id, auth.uid(), 'p2', coalesce(p_display, ''));
  return json_build_object('id', h.id, 'code', h.code);
end $$;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

-- ---------- atualização em tempo real ----------
do $$ begin
  begin alter publication supabase_realtime add table public.records; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
end $$;

-- ---------- fotos dos comprovantes (privadas, só a casa vê) ----------
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

drop policy if exists "comprovantes: ver" on storage.objects;
create policy "comprovantes: ver" on storage.objects for select
  using (bucket_id = 'comprovantes' and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "comprovantes: enviar" on storage.objects;
create policy "comprovantes: enviar" on storage.objects for insert
  with check (bucket_id = 'comprovantes' and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists "comprovantes: apagar" on storage.objects;
create policy "comprovantes: apagar" on storage.objects for delete
  using (bucket_id = 'comprovantes' and public.is_member(((storage.foldername(name))[1])::uuid));
